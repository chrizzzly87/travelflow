import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowSquareOut,
  DotsThreeVertical,
  MapPin,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  AdminShell,
  type AdminDateRange,
} from "../components/admin/AdminShell";
import { isIsoDateInRange } from "../components/admin/adminDateRange";
import {
  AI_MODEL_CATALOG,
  getDefaultCreateTripModel,
} from "../config/aiModelCatalog";
import { getAiProviderMetadata } from "../config/aiProviderCatalog";
import { extractAiRuntimeSecurityMetadata } from "../shared/aiRuntimeSecurity";
import {
  adminGetUserProfile,
  adminHardDeleteTrip,
  adminListTrips,
  adminListUsers,
  adminUpdateTrip,
  type AdminTripRecord,
  type AdminUserRecord,
} from "../services/adminService";
import {
  buildDangerConfirmDialog,
  buildTransferTargetPromptDialog,
} from "../services/appDialogPresets";
import {
  dbAdminOverrideTripCommit,
  dbGetTrip,
  dbUpsertTrip,
} from "../services/dbService";
import { getTripCityStops, buildMiniMapUrl } from "../components/TripManager";
import type {
  ITrip,
  TripGenerationAttemptSummary,
  TripGenerationJobSummary,
  TripGenerationState,
} from "../types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { AdminReloadButton } from "../components/admin/AdminReloadButton";
import {
  AdminFilterMenu,
  type AdminFilterMenuOption,
} from "../components/admin/AdminFilterMenu";
import { AdminCountUpNumber } from "../components/admin/AdminCountUpNumber";
import { CopyableUuid } from "../components/admin/CopyableUuid";
import { AiProviderLogo } from "../components/admin/AiProviderLogo";
import {
  readAdminCache,
  writeAdminCache,
} from "../components/admin/adminLocalCache";
import { Drawer, DrawerContent } from "../components/ui/drawer";
import { Checkbox } from "../components/ui/checkbox";
import { useAppDialog } from "../components/AppDialogProvider";
import { showAppToast } from "../components/ui/appToast";
import {
  AdminSortHeaderButton,
  ADMIN_TABLE_ROW_SURFACE_CLASS,
  ADMIN_TABLE_SORTED_CELL_CLASS,
  ADMIN_TABLE_SORTED_HEADER_CLASS,
  getAdminStickyBodyCellClass,
  getAdminStickyHeaderCellClass,
} from "../components/admin/AdminDataTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { generateTripId } from "../utils";
import {
  getLatestTripGenerationAttempt,
  getTripGenerationState,
  normalizeTripGenerationAttemptsForDisplay,
} from "../services/tripGenerationDiagnosticsService";
import { retryTripGenerationWithDefaultModel } from "../services/tripGenerationRetryService";
import { listAdminTripGenerationAttempts } from "../services/tripGenerationAttemptLogService";
import { buildBenchmarkScenarioImportUrl } from "../services/tripGenerationBenchmarkBridge";
import {
  listTripGenerationJobsByTrip,
  requeueTripGenerationJob,
} from "../services/tripGenerationJobService";

const toDateTimeInputValue = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const fromDateTimeInputValue = (value: string): string | null => {
  if (!value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const asAttemptMetadataBoolean = (value: unknown): boolean | null =>
  value === true ? true : value === false ? false : null;

const describeAttemptOutcome = (
  attempt: TripGenerationAttemptSummary | null,
  options: {
    providerReached?: boolean | null;
    securityStage?: string | null;
    blocked?: boolean;
    guardDecision?: string | null;
  },
): string => {
  if (!attempt) return "n/a";
  if (attempt.errorCode === "AI_GENERATION_ABORTED_BY_USER") {
    return "User aborted retry before completion";
  }
  if (options.blocked && options.securityStage === "input_preflight") {
    return "Rejected before provider call";
  }
  if (options.blocked && options.securityStage === "output_postflight") {
    return "Rejected after provider response";
  }
  if (attempt.state === "succeeded") {
    return "Completed successfully";
  }
  if (attempt.state === "queued") {
    return "Queued for generation";
  }
  if (attempt.state === "running") {
    return "Generation in progress";
  }
  if (options.providerReached === true) {
    return "Failed after provider response";
  }
  if (options.providerReached === false) {
    return "Failed before provider response";
  }
  if (options.guardDecision === "warn") {
    return "Suspicious but allowed";
  }
  return "Failed attempt";
};

type TripStatus = "active" | "archived" | "expired";
type TripExpirationFilter =
  | "no_expiration"
  | "already_expired"
  | "expiring_24h"
  | "expiring_7d"
  | "scheduled";
type TripVisibleColumnId =
  | "owner"
  | "lifecycle"
  | "generation"
  | "source"
  | "expires"
  | "updated"
  | "created"
  | "archived";
type TripSortColumn =
  | "trip"
  | "owner"
  | "lifecycle"
  | "generation"
  | "source"
  | "expires"
  | "updated"
  | "created"
  | "archived";
type TripSortDirection = "asc" | "desc";

const TRIPS_PAGE_SIZE = 25;
const TRIPS_CACHE_KEY = "admin.trips.cache.v1";
const DEFAULT_TRIP_SORT_COLUMN: TripSortColumn = "updated";
const DEFAULT_TRIP_SORT_DIRECTION: TripSortDirection = "desc";
const TRIP_STATUS_VALUES: readonly TripStatus[] = [
  "active",
  "archived",
  "expired",
];
const TRIP_GENERATION_STATE_VALUES: readonly TripGenerationState[] = [
  "failed",
  "running",
  "queued",
  "succeeded",
];
const TRIP_EXPIRATION_FILTER_VALUES: readonly TripExpirationFilter[] = [
  "already_expired",
  "expiring_24h",
  "expiring_7d",
  "scheduled",
  "no_expiration",
];
const TRIP_VISIBLE_COLUMN_IDS: readonly TripVisibleColumnId[] = [
  "owner",
  "lifecycle",
  "generation",
  "source",
  "expires",
  "updated",
  "created",
  "archived",
];
const TRIP_VISIBLE_COLUMN_OPTIONS: Array<{
  value: TripVisibleColumnId;
  label: string;
}> = [
  { value: "owner", label: "Owner" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "generation", label: "Generation" },
  { value: "source", label: "Source" },
  { value: "expires", label: "Expires" },
  { value: "updated", label: "Last update" },
  { value: "created", label: "Created" },
  { value: "archived", label: "Archived at" },
];
const DEFAULT_VISIBLE_TRIP_COLUMNS: TripVisibleColumnId[] = [
  "owner",
  "lifecycle",
  "generation",
  "source",
  "expires",
  "updated",
  "created",
];
const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});
const DEFAULT_RETRY_MODEL_ID = getDefaultCreateTripModel().id;
const ACTIVE_RETRY_MODEL_OPTIONS = AI_MODEL_CATALOG.filter(
  (entry) => entry.availability === "active",
).map((entry) => ({
  id: entry.id,
  provider: entry.provider,
  providerLabel: getAiProviderMetadata(entry.provider).label,
  model: entry.model,
  label: `${getAiProviderMetadata(entry.provider).label} · ${entry.model}`,
}));

const parseQueryMultiValue = <T extends string>(
  value: string | null,
  allowedValues: readonly T[],
): T[] => {
  if (!value) return [];
  const allowSet = new Set<string>(allowedValues);
  const unique = new Set<string>();
  value
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      if (allowSet.has(chunk)) unique.add(chunk);
    });
  return allowedValues.filter((candidate) => unique.has(candidate));
};

const parseRawQueryMultiValue = (value: string | null): string[] => {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean),
    ),
  );
};

const sanitizeTripVisibleColumns = (
  values: string[] | null | undefined,
): TripVisibleColumnId[] => {
  if (!Array.isArray(values) || values.length === 0)
    return [...DEFAULT_VISIBLE_TRIP_COLUMNS];
  const unique = new Set<string>();
  values.forEach((value) => {
    if (TRIP_VISIBLE_COLUMN_IDS.includes(value as TripVisibleColumnId)) {
      unique.add(value);
    }
  });
  const ordered = TRIP_VISIBLE_COLUMN_IDS.filter((columnId) =>
    unique.has(columnId),
  );
  return ordered.length > 0 ? ordered : [...DEFAULT_VISIBLE_TRIP_COLUMNS];
};

const parseTripVisibleColumns = (
  value: string | null,
): TripVisibleColumnId[] => {
  const parsed = parseRawQueryMultiValue(value);
  return sanitizeTripVisibleColumns(parsed);
};

const parseTripSortColumn = (value: string | null): TripSortColumn => {
  if (
    value === "trip" ||
    value === "owner" ||
    value === "lifecycle" ||
    value === "generation" ||
    value === "source" ||
    value === "expires" ||
    value === "updated" ||
    value === "created" ||
    value === "archived"
  ) {
    return value;
  }
  return DEFAULT_TRIP_SORT_COLUMN;
};

const parseTripSortDirection = (value: string | null): TripSortDirection =>
  value === "asc" ? "asc" : "desc";

const parsePositivePage = (value: string | null): number => {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
};

const formatTimestamp = (
  value: string | null | undefined,
  fallback = "Not set",
): string => {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  return new Date(parsed).toLocaleString();
};

const formatRelativeTimestamp = (
  value: string | null | undefined,
  fallback = "No data",
): string => {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  const diffMs = parsed - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;
  if (absDiffMs < minuteMs)
    return relativeTimeFormatter.format(Math.round(diffMs / 1000), "second");
  if (absDiffMs < hourMs)
    return relativeTimeFormatter.format(
      Math.round(diffMs / minuteMs),
      "minute",
    );
  if (absDiffMs < dayMs)
    return relativeTimeFormatter.format(Math.round(diffMs / hourMs), "hour");
  if (absDiffMs < weekMs)
    return relativeTimeFormatter.format(Math.round(diffMs / dayMs), "day");
  if (absDiffMs < monthMs)
    return relativeTimeFormatter.format(Math.round(diffMs / weekMs), "week");
  if (absDiffMs < yearMs)
    return relativeTimeFormatter.format(Math.round(diffMs / monthMs), "month");
  return relativeTimeFormatter.format(Math.round(diffMs / yearMs), "year");
};

const formatDurationMs = (durationMs: number | null | undefined): string => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs))
    return "n/a";
  if (durationMs < 1_000) return `${Math.max(0, Math.round(durationMs))} ms`;
  return `${(Math.max(0, durationMs) / 1_000).toFixed(2)} s`;
};

const normalizeIsoTimestamp = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const formatSourceKindLabel = (
  sourceKind: string | null | undefined,
): string => {
  const normalized = (sourceKind || "").trim();
  if (!normalized) return "Unknown source";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getExpirationFilterLabel = (value: TripExpirationFilter): string => {
  if (value === "already_expired") return "Already expired";
  if (value === "expiring_24h") return "Expiring in 24h";
  if (value === "expiring_7d") return "Expiring in 7d";
  if (value === "scheduled") return "Scheduled";
  return "No expiration";
};

const getTripExpirationBucket = (
  trip: Pick<AdminTripRecord, "trip_expires_at">,
): TripExpirationFilter => {
  const expiresAt = trip.trip_expires_at;
  if (!expiresAt) return "no_expiration";
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return "no_expiration";
  const diffMs = parsed - Date.now();
  if (diffMs <= 0) return "already_expired";
  if (diffMs <= 24 * 60 * 60 * 1000) return "expiring_24h";
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) return "expiring_7d";
  return "scheduled";
};

const getUserDisplayName = (user: AdminUserRecord): string => {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (user.display_name?.trim()) return user.display_name.trim();
  if (user.username_display?.trim()) return user.username_display.trim();
  if (user.username?.trim()) return user.username.trim();
  if (user.email?.trim()) return user.email.trim();
  return user.user_id;
};

const getUserReferenceText = (user: AdminUserRecord): string => {
  const name = getUserDisplayName(user);
  const email = (user.email || "").trim();
  return email ? `${name} (${email})` : `${name} (${user.user_id})`;
};

const formatAccountStatusLabel = (
  status: string | null | undefined,
): string => {
  const normalized = (status || "active").toLowerCase();
  if (normalized === "disabled") return "Suspended";
  if (normalized === "deleted") return "Deleted";
  return "Active";
};

const getLifecyclePillClassName = (status: TripStatus): string => {
  if (status === "archived")
    return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "expired")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const getGenerationPillClassName = (state: TripGenerationState): string => {
  if (state === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (state === "running" || state === "queued")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const getGenerationStateLabel = (state: TripGenerationState): string => {
  if (state === "failed") return "failed";
  if (state === "running") return "running";
  if (state === "queued") return "queued";
  return "succeeded";
};

const getGenerationJobPillClassName = (
  state: TripGenerationJobSummary["state"],
): string => {
  if (state === "dead") return "border-rose-300 bg-rose-100 text-rose-800";
  if (state === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (state === "queued" || state === "leased")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const resolveTripGenerationState = (
  trip: AdminTripRecord,
): TripGenerationState => {
  const state = trip.generation_state;
  if (
    state === "failed" ||
    state === "running" ||
    state === "queued" ||
    state === "succeeded"
  )
    return state;
  return "succeeded";
};

const resolveRetryModelIdFromAttempt = (
  attempt: TripGenerationAttemptSummary | null | undefined,
): string => {
  if (!attempt) return DEFAULT_RETRY_MODEL_ID;
  const matching = ACTIVE_RETRY_MODEL_OPTIONS.find(
    (option) =>
      option.provider === (attempt.provider || "") &&
      option.model === (attempt.model || ""),
  );
  return matching?.id || DEFAULT_RETRY_MODEL_ID;
};

const isLikelyUserId = (value: string): boolean =>
  USER_ID_PATTERN.test(value.trim());
const isLikelyEmail = (value: string): boolean =>
  EMAIL_PATTERN.test(value.trim());

const getTripLink = (tripId: string): string =>
  `/trip/${encodeURIComponent(tripId)}`;

const buildDuplicateTitle = (title: string | null): string => {
  const baseTitle = title?.trim() || "Untitled trip";
  if (/^Copy of /i.test(baseTitle)) return baseTitle;
  return `Copy of ${baseTitle}`;
};

const sanitizeFilenameSegment = (value: string): string => {
  const normalized = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "trip";
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const TripRowActionsMenu: React.FC<{
  trip: AdminTripRecord;
  disabled: boolean;
  onPreviewTrip: (trip: AdminTripRecord) => void;
  onDuplicateTrip: (trip: AdminTripRecord) => void;
  onTransferTrip: (trip: AdminTripRecord) => void;
  onDownloadTripJson: (trip: AdminTripRecord) => void;
  onSoftDeleteTrip: (trip: AdminTripRecord) => void;
  onHardDeleteTrip: (trip: AdminTripRecord) => void;
}> = ({
  trip,
  disabled,
  onPreviewTrip,
  onDuplicateTrip,
  onTransferTrip,
  onDownloadTripJson,
  onSoftDeleteTrip,
  onHardDeleteTrip,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isArchived = trip.status === "archived";

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  const runAction = (callback: (trip: AdminTripRecord) => void) => {
    setIsOpen(false);
    callback(trip);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Open trip actions"
      >
        <DotsThreeVertical size={16} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[180px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          <button
            type="button"
            onClick={() => runAction(onPreviewTrip)}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Preview trip
          </button>
          <button
            type="button"
            onClick={() => runAction(onDuplicateTrip)}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Duplicate trip
          </button>
          <button
            type="button"
            onClick={() => runAction(onTransferTrip)}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Transfer owner
          </button>
          <button
            type="button"
            onClick={() => runAction(onDownloadTripJson)}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Download JSON
          </button>
          <div className="my-1 h-px bg-slate-100" />
          <button
            type="button"
            onClick={() => runAction(onSoftDeleteTrip)}
            className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
              isArchived
                ? "text-emerald-800 hover:bg-emerald-50"
                : "text-amber-800 hover:bg-amber-50"
            }`}
          >
            {isArchived ? "Restore trip" : "Soft-delete trip"}
          </button>
          <button
            type="button"
            onClick={() => runAction(onHardDeleteTrip)}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-rose-800 hover:bg-rose-50"
          >
            Hard delete trip
          </button>
        </div>
      )}
    </div>
  );
};

export const AdminTripsPage: React.FC = () => {
  const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cachedTrips = useMemo(
    () => readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []),
    [],
  );
  const [trips, setTrips] = useState<AdminTripRecord[]>(cachedTrips);
  const [isLoading, setIsLoading] = useState(() => cachedTrips.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchValue, setSearchValue] = useState(
    () => searchParams.get("q") || "",
  );
  const [statusFilters, setStatusFilters] = useState<TripStatus[]>(() =>
    parseQueryMultiValue(searchParams.get("status"), TRIP_STATUS_VALUES),
  );
  const [generationStateFilters, setGenerationStateFilters] = useState<
    TripGenerationState[]
  >(() =>
    parseQueryMultiValue(
      searchParams.get("generation"),
      TRIP_GENERATION_STATE_VALUES,
    ),
  );
  const [expirationFilters, setExpirationFilters] = useState<
    TripExpirationFilter[]
  >(() =>
    parseQueryMultiValue(
      searchParams.get("expires"),
      TRIP_EXPIRATION_FILTER_VALUES,
    ),
  );
  const [sourceFilters, setSourceFilters] = useState<string[]>(() =>
    parseRawQueryMultiValue(searchParams.get("source")),
  );
  const [visibleColumns, setVisibleColumns] = useState<TripVisibleColumnId[]>(
    () => parseTripVisibleColumns(searchParams.get("cols")),
  );
  const [sortColumn, setSortColumn] = useState<TripSortColumn>(() =>
    parseTripSortColumn(searchParams.get("sort")),
  );
  const [sortDirection, setSortDirection] = useState<TripSortDirection>(() =>
    parseTripSortDirection(searchParams.get("dir")),
  );
  const [page, setPage] = useState(() =>
    parsePositivePage(searchParams.get("page")),
  );
  const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
    const value = searchParams.get("range");
    if (value === "7d" || value === "30d" || value === "90d" || value === "all")
      return value;
    return "30d";
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
  const tripsTableScrollRef = useRef<HTMLDivElement | null>(null);
  const [
    isTripsTableScrolledHorizontally,
    setIsTripsTableScrolledHorizontally,
  ] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [selectedOwnerProfile, setSelectedOwnerProfile] =
    useState<AdminUserRecord | null>(null);
  const [isOwnerDrawerOpen, setIsOwnerDrawerOpen] = useState(false);
  const [selectedTripDrawerId, setSelectedTripDrawerId] = useState<
    string | null
  >(null);
  const [isTripDrawerOpen, setIsTripDrawerOpen] = useState(false);
  const [selectedFullTrip, setSelectedFullTrip] = useState<ITrip | null>(null);
  const [selectedTripAttemptLogRows, setSelectedTripAttemptLogRows] = useState<
    TripGenerationAttemptSummary[]
  >([]);
  const [selectedTripGenerationJobRows, setSelectedTripGenerationJobRows] =
    useState<TripGenerationJobSummary[]>([]);
  const [isLoadingTripAttemptLogRows, setIsLoadingTripAttemptLogRows] =
    useState(false);
  const [isLoadingTripGenerationJobRows, setIsLoadingTripGenerationJobRows] =
    useState(false);
  const [requeueingGenerationJobId, setRequeueingGenerationJobId] = useState<
    string | null
  >(null);
  const [isRetryingGeneration, setIsRetryingGeneration] = useState(false);
  const [generationNowMs, setGenerationNowMs] = useState(() => Date.now());
  const [drawerRetryModelId, setDrawerRetryModelId] = useState<string>(
    DEFAULT_RETRY_MODEL_ID,
  );
  const [isLoadingFullTrip, setIsLoadingFullTrip] = useState(false);
  const [isLoadingOwnerProfile, setIsLoadingOwnerProfile] = useState(false);
  const [drawerLifecycleDraft, setDrawerLifecycleDraft] =
    useState<TripStatus>("active");
  const [drawerExpirationDraft, setDrawerExpirationDraft] = useState("");
  const handledDeepLinkedOwnerIdRef = useRef<string | null>(null);
  const handledDeepLinkedTripIdRef = useRef<string | null>(null);
  const deepLinkedOwnerId = useMemo(() => {
    const drawer = searchParams.get("drawer");
    const userId = searchParams.get("user");
    if (drawer !== "user" || !userId) return null;
    return userId;
  }, [searchParams]);
  const deepLinkedTripId = useMemo(() => {
    const drawer = searchParams.get("drawer");
    const tripId = searchParams.get("trip");
    if (drawer !== "trip" || !tripId) return null;
    return tripId;
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    const trimmedSearch = searchValue.trim();
    if (trimmedSearch) next.set("q", trimmedSearch);
    if (
      statusFilters.length > 0 &&
      statusFilters.length < TRIP_STATUS_VALUES.length
    ) {
      next.set("status", statusFilters.join(","));
    }
    if (
      generationStateFilters.length > 0 &&
      generationStateFilters.length < TRIP_GENERATION_STATE_VALUES.length
    ) {
      next.set("generation", generationStateFilters.join(","));
    }
    if (
      expirationFilters.length > 0 &&
      expirationFilters.length < TRIP_EXPIRATION_FILTER_VALUES.length
    ) {
      next.set("expires", expirationFilters.join(","));
    }
    if (sourceFilters.length > 0) {
      next.set("source", sourceFilters.join(","));
    }
    const hasCustomColumns =
      visibleColumns.length !== DEFAULT_VISIBLE_TRIP_COLUMNS.length ||
      visibleColumns.some(
        (columnId, index) => columnId !== DEFAULT_VISIBLE_TRIP_COLUMNS[index],
      );
    if (hasCustomColumns) {
      next.set("cols", visibleColumns.join(","));
    }
    if (dateRange !== "30d") next.set("range", dateRange);
    if (page > 1) next.set("page", String(page));
    if (
      sortColumn !== DEFAULT_TRIP_SORT_COLUMN ||
      sortDirection !== DEFAULT_TRIP_SORT_DIRECTION
    ) {
      next.set("sort", sortColumn);
      next.set("dir", sortDirection);
    }
    const drawerTripId = selectedTripDrawerId || deepLinkedTripId;
    const drawerOwnerId = selectedOwnerId || deepLinkedOwnerId;
    if ((isTripDrawerOpen || deepLinkedTripId) && drawerTripId) {
      next.set("trip", drawerTripId);
      next.set("drawer", "trip");
    } else if ((isOwnerDrawerOpen || deepLinkedOwnerId) && drawerOwnerId) {
      next.set("user", drawerOwnerId);
      next.set("drawer", "user");
    }
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [
    dateRange,
    deepLinkedOwnerId,
    deepLinkedTripId,
    expirationFilters,
    generationStateFilters,
    isOwnerDrawerOpen,
    isTripDrawerOpen,
    page,
    searchParams,
    searchValue,
    selectedOwnerId,
    selectedTripDrawerId,
    setSearchParams,
    sortColumn,
    sortDirection,
    sourceFilters,
    statusFilters,
    visibleColumns,
  ]);

  const loadTrips = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setDataSourceNotice(null);
    try {
      const rows = await adminListTrips({
        limit: 600,
        status: "all",
      });
      setTrips(rows);
      writeAdminCache(TRIPS_CACHE_KEY, rows);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Could not load trips.";
      setErrorMessage(reason);
      const cachedRows = readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []);
      if (cachedRows.length > 0) {
        setTrips(cachedRows);
        setDataSourceNotice(
          `Live admin trips failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? "" : "s"} from this browser. Reason: ${reason}`,
        );
      } else {
        setTrips([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTripForDrawer = useMemo(
    () => trips.find((trip) => trip.trip_id === selectedTripDrawerId) || null,
    [selectedTripDrawerId, trips],
  );
  const selectedFullTripDerivedGenerationState = selectedFullTrip
    ? getTripGenerationState(selectedFullTrip, generationNowMs)
    : null;

  const shouldPollSelectedTripGenerationState =
    isTripDrawerOpen &&
    (selectedTripForDrawer?.generation_state === "running" ||
      selectedTripForDrawer?.generation_state === "queued" ||
      selectedFullTripDerivedGenerationState === "running" ||
      selectedFullTripDerivedGenerationState === "queued");

  useEffect(() => {
    if (!shouldPollSelectedTripGenerationState) return undefined;
    const timer = window.setInterval(() => {
      setGenerationNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [shouldPollSelectedTripGenerationState]);

  useEffect(() => {
    if (!selectedTripForDrawer || !selectedFullTrip) return;
    const nextState = getTripGenerationState(selectedFullTrip, generationNowMs);
    setTrips((current) => {
      let changed = false;
      const next = current.map((trip) => {
        if (trip.trip_id !== selectedTripForDrawer.trip_id) return trip;
        if (trip.generation_state === nextState) return trip;
        changed = true;
        return {
          ...trip,
          generation_state: nextState,
          updated_at:
            trip.updated_at || new Date(generationNowMs).toISOString(),
        };
      });
      return changed ? next : current;
    });
  }, [generationNowMs, selectedFullTrip, selectedTripForDrawer]);

  useEffect(() => {
    if (!selectedTripForDrawer) {
      setDrawerLifecycleDraft("active");
      setDrawerExpirationDraft("");
      return;
    }
    setDrawerLifecycleDraft(selectedTripForDrawer.status);
    setDrawerExpirationDraft(
      toDateTimeInputValue(selectedTripForDrawer.trip_expires_at),
    );
  }, [
    selectedTripForDrawer?.trip_id,
    selectedTripForDrawer?.status,
    selectedTripForDrawer?.trip_expires_at,
  ]);

  useEffect(() => {
    if (!isTripDrawerOpen || !selectedTripDrawerId || !selectedTripForDrawer) {
      setSelectedFullTrip(null);
      return;
    }

    let isMounted = true;
    setIsLoadingFullTrip(true);
    dbGetTrip(selectedTripDrawerId)
      .then((res) => {
        if (!isMounted) return;
        setSelectedFullTrip(res?.trip || null);
      })
      .catch((err) => {
        console.error("Failed to load full trip for drawer preview", err);
        if (isMounted) setSelectedFullTrip(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFullTrip(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isTripDrawerOpen, selectedTripDrawerId, selectedTripForDrawer]);

  useEffect(() => {
    if (!isTripDrawerOpen || !selectedTripDrawerId || !selectedTripForDrawer) {
      setSelectedTripAttemptLogRows([]);
      return;
    }
    let isMounted = true;
    setIsLoadingTripAttemptLogRows(true);
    void listAdminTripGenerationAttempts(selectedTripDrawerId, 24)
      .then((rows) => {
        if (!isMounted) return;
        setSelectedTripAttemptLogRows(rows);
      })
      .catch(() => {
        if (!isMounted) return;
        setSelectedTripAttemptLogRows([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingTripAttemptLogRows(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isTripDrawerOpen, selectedTripDrawerId, selectedTripForDrawer]);

  useEffect(() => {
    if (!isTripDrawerOpen || !selectedTripDrawerId || !selectedTripForDrawer) {
      setSelectedTripGenerationJobRows([]);
      return;
    }
    let isMounted = true;
    setIsLoadingTripGenerationJobRows(true);
    void listTripGenerationJobsByTrip(selectedTripDrawerId, { limit: 24 })
      .then((rows) => {
        if (!isMounted) return;
        setSelectedTripGenerationJobRows(rows);
      })
      .catch(() => {
        if (!isMounted) return;
        setSelectedTripGenerationJobRows([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingTripGenerationJobRows(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isTripDrawerOpen, selectedTripDrawerId, selectedTripForDrawer]);

  useEffect(() => {
    if (!shouldPollSelectedTripGenerationState || !selectedTripDrawerId)
      return undefined;

    let cancelled = false;
    const pollTripGenerationUpdates = async () => {
      try {
        const [tripResult, attemptRows, jobRows] = await Promise.all([
          dbGetTrip(selectedTripDrawerId),
          listAdminTripGenerationAttempts(selectedTripDrawerId, 24),
          listTripGenerationJobsByTrip(selectedTripDrawerId, { limit: 24 }),
        ]);
        if (cancelled) return;

        if (Array.isArray(attemptRows)) {
          setSelectedTripAttemptLogRows(attemptRows);
        }
        if (Array.isArray(jobRows)) {
          setSelectedTripGenerationJobRows(jobRows);
        }

        const nextTrip = tripResult?.trip || null;
        if (!nextTrip) return;
        setSelectedFullTrip(nextTrip);
        const nextState = getTripGenerationState(nextTrip, Date.now());
        setTrips((current) => {
          let changed = false;
          const next = current.map((trip) => {
            if (trip.trip_id !== selectedTripDrawerId) return trip;
            if (trip.generation_state === nextState) return trip;
            changed = true;
            return {
              ...trip,
              generation_state: nextState,
            };
          });
          return changed ? next : current;
        });
      } catch {
        // Keep the current state and continue polling; failures are transient.
      }
    };

    void pollTripGenerationUpdates();
    const timer = window.setInterval(() => {
      void pollTripGenerationUpdates();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedTripDrawerId, shouldPollSelectedTripGenerationState]);

  const previewCityStops = useMemo(() => {
    if (!selectedFullTrip) return [];
    return getTripCityStops(selectedFullTrip);
  }, [selectedFullTrip]);

  const previewMapUrl = useMemo(() => {
    if (!selectedFullTrip) return null;
    return buildMiniMapUrl(selectedFullTrip, "en");
  }, [selectedFullTrip]);

  const selectedTripGenerationState = useMemo<TripGenerationState>(() => {
    if (selectedFullTripDerivedGenerationState) {
      return selectedFullTripDerivedGenerationState;
    }
    if (selectedTripForDrawer) {
      return resolveTripGenerationState(selectedTripForDrawer);
    }
    return "succeeded";
  }, [selectedFullTripDerivedGenerationState, selectedTripForDrawer]);

  const selectedTripGenerationAttempts = useMemo<
    TripGenerationAttemptSummary[]
  >(() => {
    const metaAttempts = Array.isArray(
      selectedFullTrip?.aiMeta?.generation?.attempts,
    )
      ? selectedFullTrip.aiMeta.generation.attempts
      : [];
    return normalizeTripGenerationAttemptsForDisplay(
      [...selectedTripAttemptLogRows, ...metaAttempts],
      {
        nowMs: generationNowMs,
        limit: 12,
      },
    );
  }, [generationNowMs, selectedFullTrip, selectedTripAttemptLogRows]);

  const selectedTripLatestAttempt =
    useMemo<TripGenerationAttemptSummary | null>(() => {
      if (selectedTripGenerationAttempts.length > 0)
        return selectedTripGenerationAttempts[0];
      if (selectedFullTrip) {
        return getLatestTripGenerationAttempt(selectedFullTrip);
      }
      return null;
    }, [selectedFullTrip, selectedTripGenerationAttempts]);

  useEffect(() => {
    if (!isTripDrawerOpen || !selectedTripForDrawer) {
      setDrawerRetryModelId(DEFAULT_RETRY_MODEL_ID);
      return;
    }
    setDrawerRetryModelId(
      resolveRetryModelIdFromAttempt(selectedTripLatestAttempt),
    );
  }, [
    isTripDrawerOpen,
    selectedTripForDrawer?.trip_id,
    selectedTripLatestAttempt?.id,
    selectedTripLatestAttempt?.model,
    selectedTripLatestAttempt?.provider,
  ]);

  const selectedTripGenerationMeta =
    selectedFullTrip?.aiMeta?.generation || null;
  const selectedTripLatestAttemptMetadata = useMemo<Record<
    string,
    unknown
  > | null>(() => {
    const metadata = selectedTripLatestAttempt?.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
      return null;
    return metadata as Record<string, unknown>;
  }, [selectedTripLatestAttempt?.metadata]);
  const selectedTripRequestPayload = useMemo<Record<
    string,
    unknown
  > | null>(() => {
    const payload = selectedTripLatestAttemptMetadata?.requestPayload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return null;
    return payload as Record<string, unknown>;
  }, [selectedTripLatestAttemptMetadata]);
  const selectedTripLatestAttemptSecurity = useMemo(
    () =>
      extractAiRuntimeSecurityMetadata(
        selectedTripLatestAttemptMetadata?.security,
      ),
    [selectedTripLatestAttemptMetadata],
  );
  const selectedTripOrchestrationMode = useMemo(() => {
    const value = selectedTripLatestAttemptMetadata?.orchestration;
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  }, [selectedTripLatestAttemptMetadata]);
  const selectedTripLatestAttemptDetails = useMemo(() => {
    const value = selectedTripLatestAttemptMetadata?.details;
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  }, [selectedTripLatestAttemptMetadata]);
  const selectedTripLatestAttemptProviderReached = useMemo(
    () =>
      asAttemptMetadataBoolean(
        selectedTripLatestAttemptMetadata?.provider_reached ??
          selectedTripLatestAttemptMetadata?.providerReached,
      ),
    [selectedTripLatestAttemptMetadata],
  );
  const selectedTripLatestAttemptOutcome = useMemo(
    () =>
      describeAttemptOutcome(selectedTripLatestAttempt, {
        providerReached: selectedTripLatestAttemptProviderReached,
        securityStage: selectedTripLatestAttemptSecurity?.stage || null,
        blocked: selectedTripLatestAttemptSecurity?.blocked === true,
        guardDecision: selectedTripLatestAttemptSecurity?.guardDecision || null,
      }),
    [
      selectedTripLatestAttempt,
      selectedTripLatestAttemptProviderReached,
      selectedTripLatestAttemptSecurity?.blocked,
      selectedTripLatestAttemptSecurity?.guardDecision,
      selectedTripLatestAttemptSecurity?.stage,
    ],
  );
  const selectedTripInputSnapshot = useMemo(() => {
    return selectedTripGenerationMeta?.inputSnapshot || null;
  }, [selectedTripGenerationMeta?.inputSnapshot]);
  const selectedTripRetryCount = useMemo(() => {
    if (typeof selectedTripGenerationMeta?.retryCount === "number") {
      return Math.max(0, Math.round(selectedTripGenerationMeta.retryCount));
    }
    return Math.max(
      0,
      selectedTripGenerationAttempts.filter((attempt) =>
        attempt.source.includes("retry"),
      ).length,
    );
  }, [selectedTripGenerationAttempts, selectedTripGenerationMeta?.retryCount]);
  const selectedTripDeadLetterJobCount = useMemo(
    () =>
      selectedTripGenerationJobRows.filter((job) => job.state === "dead")
        .length,
    [selectedTripGenerationJobRows],
  );
  const selectedTripLatestGenerationJob = useMemo(
    () => selectedTripGenerationJobRows[0] || null,
    [selectedTripGenerationJobRows],
  );
  const selectedTripLatestGenerationJobPayload = useMemo<Record<
    string,
    unknown
  > | null>(() => {
    const payload = selectedTripLatestGenerationJob?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return null;
    return payload as Record<string, unknown>;
  }, [selectedTripLatestGenerationJob?.payload]);

  const groupedRetryModelOptions = useMemo(() => {
    const groups = new Map<string, typeof ACTIVE_RETRY_MODEL_OPTIONS>();
    ACTIVE_RETRY_MODEL_OPTIONS.forEach((option) => {
      const key = option.providerLabel;
      const existing = groups.get(key) || [];
      existing.push(option);
      groups.set(key, existing);
    });
    return Array.from(groups.entries()).map(([providerLabel, options]) => ({
      providerLabel,
      options,
    }));
  }, []);

  const selectedDrawerRetryModelOption = useMemo(
    () =>
      ACTIVE_RETRY_MODEL_OPTIONS.find(
        (option) => option.id === drawerRetryModelId,
      ) || null,
    [drawerRetryModelId],
  );

  const canRetryGenerationInDrawer = Boolean(
    selectedTripForDrawer &&
    selectedFullTrip &&
    selectedFullTrip.aiMeta?.generation?.inputSnapshot &&
    selectedTripGenerationState !== "running" &&
    selectedTripGenerationState !== "queued" &&
    !isRetryingGeneration,
  );

  const drawerRetryDisabledReason = isRetryingGeneration
    ? "Retry is already in progress."
    : !selectedTripForDrawer
      ? "No trip selected."
      : !selectedFullTrip?.aiMeta?.generation?.inputSnapshot
        ? "Retry is unavailable because no input snapshot was captured for this trip."
        : selectedTripGenerationState === "running" ||
            selectedTripGenerationState === "queued"
          ? "Retry is unavailable while generation is still running."
          : null;

  const visibleTrips = useMemo(() => {
    const token = searchValue.trim().toLowerCase();
    return trips.filter((trip) => {
      if (!isIsoDateInRange(trip.updated_at || trip.created_at, dateRange))
        return false;
      if (statusFilters.length > 0 && !statusFilters.includes(trip.status))
        return false;
      if (
        generationStateFilters.length > 0 &&
        !generationStateFilters.includes(resolveTripGenerationState(trip))
      )
        return false;
      if (
        expirationFilters.length > 0 &&
        !expirationFilters.includes(getTripExpirationBucket(trip))
      )
        return false;
      const normalizedSource = (trip.source_kind || "").trim() || "unknown";
      if (sourceFilters.length > 0 && !sourceFilters.includes(normalizedSource))
        return false;
      if (!token) return true;
      return (
        (trip.title || "").toLowerCase().includes(token) ||
        trip.trip_id.toLowerCase().includes(token) ||
        (trip.owner_email || "").toLowerCase().includes(token) ||
        trip.owner_id.toLowerCase().includes(token) ||
        normalizedSource.toLowerCase().includes(token)
      );
    });
  }, [
    dateRange,
    expirationFilters,
    generationStateFilters,
    searchValue,
    sourceFilters,
    statusFilters,
    trips,
  ]);

  const sortedVisibleTrips = useMemo(() => {
    const compareText = (left: string, right: string): number =>
      left.localeCompare(right, undefined, { sensitivity: "base" });
    const getDateValue = (value: string | null | undefined): number | null => {
      if (!value) return null;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const compareDate = (
      left: string | null | undefined,
      right: string | null | undefined,
    ): number => {
      const leftValue = getDateValue(left);
      const rightValue = getDateValue(right);
      if (leftValue === null && rightValue === null) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return leftValue - rightValue;
    };
    const compareBySortColumn = (
      left: AdminTripRecord,
      right: AdminTripRecord,
    ): number => {
      if (sortColumn === "trip") {
        return compareText(
          (left.title || left.trip_id).trim(),
          (right.title || right.trip_id).trim(),
        );
      }
      if (sortColumn === "owner") {
        return compareText(
          left.owner_email || left.owner_id,
          right.owner_email || right.owner_id,
        );
      }
      if (sortColumn === "lifecycle") {
        const order: Record<TripStatus, number> = {
          active: 0,
          expired: 1,
          archived: 2,
        };
        return order[left.status] - order[right.status];
      }
      if (sortColumn === "generation") {
        const order: Record<TripGenerationState, number> = {
          failed: 0,
          running: 1,
          queued: 2,
          succeeded: 3,
        };
        return (
          order[resolveTripGenerationState(left)] -
          order[resolveTripGenerationState(right)]
        );
      }
      if (sortColumn === "source") {
        return compareText(
          formatSourceKindLabel(left.source_kind),
          formatSourceKindLabel(right.source_kind),
        );
      }
      if (sortColumn === "expires") {
        return compareDate(left.trip_expires_at, right.trip_expires_at);
      }
      if (sortColumn === "updated") {
        return compareDate(left.updated_at, right.updated_at);
      }
      if (sortColumn === "created") {
        return compareDate(left.created_at, right.created_at);
      }
      if (sortColumn === "archived") {
        return compareDate(left.archived_at, right.archived_at);
      }
      return 0;
    };
    return [...visibleTrips].sort((left, right) => {
      const base = compareBySortColumn(left, right);
      if (base === 0) return left.trip_id.localeCompare(right.trip_id);
      return sortDirection === "asc" ? base : -base;
    });
  }, [sortColumn, sortDirection, visibleTrips]);
  const tripPageCount = Math.max(
    Math.ceil(sortedVisibleTrips.length / TRIPS_PAGE_SIZE),
    1,
  );
  const pagedTrips = useMemo(() => {
    const start = (page - 1) * TRIPS_PAGE_SIZE;
    return sortedVisibleTrips.slice(start, start + TRIPS_PAGE_SIZE);
  }, [page, sortedVisibleTrips]);

  const tripsInDateRange = useMemo(
    () =>
      trips.filter((trip) =>
        isIsoDateInRange(trip.updated_at || trip.created_at, dateRange),
      ),
    [dateRange, trips],
  );

  const summary = useMemo(
    () => ({
      total: visibleTrips.length,
      active: visibleTrips.filter((trip) => trip.status === "active").length,
      expired: visibleTrips.filter((trip) => trip.status === "expired").length,
      archived: visibleTrips.filter((trip) => trip.status === "archived")
        .length,
      failedGeneration: visibleTrips.filter(
        (trip) => resolveTripGenerationState(trip) === "failed",
      ).length,
    }),
    [visibleTrips],
  );
  const selectedVisibleTrips = useMemo(
    () => visibleTrips.filter((trip) => selectedTripIds.has(trip.trip_id)),
    [selectedTripIds, visibleTrips],
  );
  const areAllVisibleTripsSelected =
    visibleTrips.length > 0 &&
    visibleTrips.every((trip) => selectedTripIds.has(trip.trip_id));
  const isVisibleTripSelectionPartial =
    selectedVisibleTrips.length > 0 && !areAllVisibleTripsSelected;
  const visibleTripColumnSet = useMemo(
    () => new Set<TripVisibleColumnId>(visibleColumns),
    [visibleColumns],
  );
  const isTripColumnVisible = (columnId: TripVisibleColumnId): boolean =>
    visibleTripColumnSet.has(columnId);
  const hasStickyTripColumnPair = true;
  const tripsTableColumnCount = visibleColumns.length + 3;

  useEffect(() => {
    if (page > tripPageCount) {
      setPage(tripPageCount);
    }
  }, [page, tripPageCount]);

  const statusFilterOptions = useMemo<AdminFilterMenuOption[]>(
    () =>
      TRIP_STATUS_VALUES.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
        count: tripsInDateRange.filter((trip) => trip.status === value).length,
      })),
    [tripsInDateRange],
  );

  const generationFilterOptions = useMemo<AdminFilterMenuOption[]>(
    () =>
      TRIP_GENERATION_STATE_VALUES.map((value) => ({
        value,
        label: getGenerationStateLabel(value),
        count: tripsInDateRange.filter(
          (trip) => resolveTripGenerationState(trip) === value,
        ).length,
      })),
    [tripsInDateRange],
  );

  const expirationFilterOptions = useMemo<AdminFilterMenuOption[]>(
    () =>
      TRIP_EXPIRATION_FILTER_VALUES.map((value) => ({
        value,
        label: getExpirationFilterLabel(value),
        count: tripsInDateRange.filter(
          (trip) => getTripExpirationBucket(trip) === value,
        ).length,
      })),
    [tripsInDateRange],
  );

  const sourceFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
    const counts = new Map<string, number>();
    tripsInDateRange.forEach((trip) => {
      const normalizedSource = (trip.source_kind || "").trim() || "unknown";
      counts.set(normalizedSource, (counts.get(normalizedSource) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([value, count]) => ({
        value,
        label: formatSourceKindLabel(value),
        count,
      }));
  }, [tripsInDateRange]);

  useEffect(() => {
    if (sourceFilters.length === 0) return;
    const allowed = new Set(sourceFilterOptions.map((option) => option.value));
    setSourceFilters((current) => {
      const next = current.filter((value) => allowed.has(value));
      return next.length === current.length ? current : next;
    });
  }, [sourceFilterOptions, sourceFilters.length]);

  const visibleTripColumnOptions = useMemo<AdminFilterMenuOption[]>(
    () =>
      TRIP_VISIBLE_COLUMN_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );

  const updateTripStatus = async (
    trip: AdminTripRecord,
    patch: {
      status?: "active" | "archived" | "expired";
      tripExpiresAt?: string | null;
    },
    successMessage = "Trip updated.",
  ) => {
    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      await adminUpdateTrip(trip.trip_id, patch);
      setMessage(successMessage);
      showAppToast({
        tone: "success",
        title: "Trip saved",
        description: successMessage,
      });
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update trip.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTripDrawerExpirationIso = normalizeIsoTimestamp(
    selectedTripForDrawer?.trip_expires_at,
  );
  const drawerDraftExpirationIso = normalizeIsoTimestamp(
    fromDateTimeInputValue(drawerExpirationDraft),
  );
  const hasDrawerLifecycleChanges = Boolean(
    selectedTripForDrawer &&
    (drawerLifecycleDraft !== selectedTripForDrawer.status ||
      drawerDraftExpirationIso !== selectedTripDrawerExpirationIso),
  );

  const handleSaveDrawerLifecycle = async () => {
    if (!selectedTripForDrawer) return;
    const patch: {
      status?: "active" | "archived" | "expired";
      tripExpiresAt?: string | null;
    } = {};
    if (drawerLifecycleDraft !== selectedTripForDrawer.status) {
      patch.status = drawerLifecycleDraft;
    }
    if (drawerDraftExpirationIso !== selectedTripDrawerExpirationIso) {
      patch.tripExpiresAt = drawerDraftExpirationIso;
    }
    if (Object.keys(patch).length === 0) return;
    await updateTripStatus(
      selectedTripForDrawer,
      patch,
      "Trip lifecycle settings saved.",
    );
  };

  const handleRetryTripGeneration = async () => {
    if (!selectedTripForDrawer || !selectedFullTrip) return;
    if (!selectedFullTrip.aiMeta?.generation?.inputSnapshot) {
      setErrorMessage(
        "Retry is unavailable because this trip has no generation input snapshot.",
      );
      return;
    }

    setIsRetryingGeneration(true);
    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const result = await retryTripGenerationWithDefaultModel(
        selectedFullTrip,
        {
          source: "admin_trip_drawer",
          contextSource: "admin_trip_drawer",
          modelId: drawerRetryModelId,
          onTripUpdate: async (nextTrip) => {
            setSelectedFullTrip(nextTrip);
            const committed = await dbAdminOverrideTripCommit(
              nextTrip,
              nextTrip.defaultView ?? undefined,
              "Data: Admin retried generation",
            );
            if (!committed) {
              throw new Error(
                "Could not persist retried trip via admin override.",
              );
            }
          },
        },
      );

      if (result.state === "queued") {
        setMessage("Trip generation retry queued. Processing in background.");
      } else if (result.state === "succeeded") {
        setMessage("Trip generation retry completed.");
      } else {
        setMessage(
          "Trip generation retry failed. Diagnostics have been updated.",
        );
      }
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not retry generation.",
      );
    } finally {
      setIsRetryingGeneration(false);
      setIsSaving(false);
    }
  };

  const handleRequeueGenerationJob = async (job: TripGenerationJobSummary) => {
    if (!selectedTripForDrawer) return;
    if (job.state !== "dead" && job.state !== "failed") return;

    setRequeueingGenerationJobId(job.id);
    setErrorMessage(null);
    setMessage(null);

    try {
      const requeued = await requeueTripGenerationJob(job.id, {
        reason: "admin_trip_drawer_manual_requeue",
        resetRetryCount: true,
      });
      if (!requeued) {
        throw new Error("Could not requeue generation job.");
      }

      setMessage("Generation job requeued.");
      showAppToast({
        tone: "success",
        title: "Generation job requeued",
        description: "The async worker queue will process this job again.",
      });

      const [tripResult, attemptRows, jobRows] = await Promise.all([
        dbGetTrip(selectedTripForDrawer.trip_id),
        listAdminTripGenerationAttempts(selectedTripForDrawer.trip_id, 24),
        listTripGenerationJobsByTrip(selectedTripForDrawer.trip_id, {
          limit: 24,
        }),
      ]);

      setSelectedTripAttemptLogRows(attemptRows);
      setSelectedTripGenerationJobRows(jobRows);

      const refreshedTrip = tripResult?.trip || null;
      if (refreshedTrip) {
        setSelectedFullTrip(refreshedTrip);
        const nextState = getTripGenerationState(refreshedTrip, Date.now());
        setTrips((current) =>
          current.map((trip) =>
            trip.trip_id === refreshedTrip.id
              ? {
                  ...trip,
                  generation_state: nextState,
                  updated_at: new Date().toISOString(),
                }
              : trip,
          ),
        );
      } else {
        await loadTrips();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not requeue generation job.",
      );
    } finally {
      setRequeueingGenerationJobId(null);
    }
  };

  const handleOpenBenchmarkFromDrawer = () => {
    if (!selectedTripForDrawer) return;
    const snapshot =
      selectedFullTrip?.aiMeta?.generation?.inputSnapshot || null;
    const importUrl = buildBenchmarkScenarioImportUrl({
      snapshot,
      source: "admin_trip_drawer",
      tripId: selectedTripForDrawer.trip_id,
    });
    if (!importUrl) {
      setErrorMessage(
        "No generation input snapshot available for benchmark import.",
      );
      return;
    }
    window.open(importUrl, "_blank", "noopener,noreferrer");
    setMessage("Opened AI Benchmark with imported trip generation mask.");
  };

  const resolveTransferTargetUser = async (
    rawInput: string,
  ): Promise<AdminUserRecord> => {
    const normalizedInput = rawInput.trim();
    if (!normalizedInput) {
      throw new Error("Enter a target user email or UUID.");
    }
    const normalizedLower = normalizedInput.toLowerCase();

    if (isLikelyUserId(normalizedInput)) {
      const profile = await adminGetUserProfile(normalizedInput);
      if (profile) return profile;
    }

    if (isLikelyEmail(normalizedInput)) {
      const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
      const exactMatches = rows.filter(
        (candidate) =>
          (candidate.email || "").trim().toLowerCase() === normalizedLower,
      );
      if (exactMatches.length > 1) {
        throw new Error(
          "Multiple users found for that email. Enter a UUID instead.",
        );
      }
      if (exactMatches.length === 1) {
        return exactMatches[0];
      }
    }

    const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
    const idMatches = rows.filter(
      (candidate) => candidate.user_id.toLowerCase() === normalizedLower,
    );
    if (idMatches.length > 1) {
      throw new Error(
        "Multiple users matched that UUID. Enter a more specific value.",
      );
    }
    if (idMatches.length === 1) {
      return idMatches[0];
    }

    throw new Error(
      "Target user not found. Enter an existing user email or UUID.",
    );
  };

  const handleOpenTripPreview = (trip: AdminTripRecord) => {
    const href = getTripLink(trip.trip_id);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleTransferTrip = async (trip: AdminTripRecord) => {
    const transferTargetInput = await promptDialog(
      buildTransferTargetPromptDialog({
        title: "Transfer trip owner",
        message: "Enter the target user email or UUID for this trip.",
        confirmLabel: "Continue",
        label: "Target owner (email or UUID)",
      }),
    );
    if (transferTargetInput === null) return;

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      const targetUser = await resolveTransferTargetUser(transferTargetInput);
      if (targetUser.user_id === trip.owner_id) {
        throw new Error("Target owner is already the current owner.");
      }
      const targetStatus = (
        targetUser.account_status || "active"
      ).toLowerCase();
      if (targetStatus !== "active") {
        throw new Error("Target user must be an active account.");
      }

      const confirmed = await confirmDialog(
        buildDangerConfirmDialog({
          title: "Confirm transfer",
          message: `Transfer this trip to ${getUserReferenceText(targetUser)}?`,
          confirmLabel: "Transfer",
        }),
      );
      if (!confirmed) return;

      await adminUpdateTrip(trip.trip_id, { ownerId: targetUser.user_id });
      setMessage(
        `Trip owner transferred to ${getUserReferenceText(targetUser)}.`,
      );
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not transfer trip owner.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTrip = async (trip: AdminTripRecord) => {
    const transferTargetInput = await promptDialog(
      buildTransferTargetPromptDialog({
        title: "Duplicate trip",
        message:
          "Optionally enter a target user email or UUID for the duplicated trip. Leave blank to keep ownership unchanged.",
        label: "Target owner (optional)",
        defaultValue: "",
        confirmLabel: "Duplicate",
        tone: "default",
      }),
    );
    if (transferTargetInput === null) return;

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      const targetInput = transferTargetInput.trim();
      const targetUser = targetInput
        ? await resolveTransferTargetUser(targetInput)
        : null;
      if (targetUser) {
        const targetStatus = (
          targetUser.account_status || "active"
        ).toLowerCase();
        if (targetStatus !== "active") {
          throw new Error("Target user must be an active account.");
        }
      }

      const result = await dbGetTrip(trip.trip_id);
      if (!result?.trip) {
        throw new Error("Could not load source trip data for duplication.");
      }

      const sourceTrip = result.trip;
      const now = Date.now();
      const duplicatedTripId = generateTripId();
      const duplicatedTrip: ITrip = {
        ...sourceTrip,
        id: duplicatedTripId,
        title: buildDuplicateTitle(sourceTrip.title || trip.title),
        createdAt: now,
        updatedAt: now,
        status: "active",
        tripExpiresAt: null,
        isFavorite: false,
        sourceKind: "duplicate_trip",
        forkedFromTripId: trip.trip_id,
      };

      const upsertedTripId = await dbUpsertTrip(
        duplicatedTrip,
        result.view || undefined,
      );
      if (!upsertedTripId) {
        throw new Error("Could not save duplicated trip.");
      }

      if (targetUser && targetUser.user_id !== trip.owner_id) {
        await adminUpdateTrip(upsertedTripId, { ownerId: targetUser.user_id });
        setMessage(
          `Trip duplicated and transferred to ${getUserReferenceText(targetUser)}.`,
        );
      } else {
        setMessage("Trip duplicated.");
      }

      await loadTrips();
      openTripDrawer(upsertedTripId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not duplicate trip.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadTripJson = async (trip: AdminTripRecord) => {
    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      const result = await dbGetTrip(trip.trip_id);
      if (!result?.trip) {
        throw new Error("Could not load trip JSON.");
      }
      const payload = {
        exported_at: new Date().toISOString(),
        trip_id: trip.trip_id,
        owner_id: trip.owner_id,
        owner_email: trip.owner_email,
        title: trip.title,
        status: trip.status,
        trip_expires_at: trip.trip_expires_at,
        trip: result.trip,
        view: result.view,
        access: result.access,
      };
      const fileName = `${sanitizeFilenameSegment(trip.title || "trip")}-${sanitizeFilenameSegment(trip.trip_id)}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      downloadBlob(blob, fileName);
      setMessage("Trip JSON downloaded.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not download trip JSON.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSoftDeleteTrip = async (trip: AdminTripRecord) => {
    const nextStatus: TripStatus =
      trip.status === "archived" ? "active" : "archived";
    if (nextStatus === "archived") {
      const confirmed = await confirmDialog(
        buildDangerConfirmDialog({
          title: "Soft delete trip",
          message: `Archive ${trip.title || trip.trip_id}?`,
          confirmLabel: "Archive",
        }),
      );
      if (!confirmed) return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      await adminUpdateTrip(trip.trip_id, { status: nextStatus });
      setMessage(
        nextStatus === "archived" ? "Trip archived." : "Trip restored.",
      );
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update trip status.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleHardDeleteTrip = async (trip: AdminTripRecord) => {
    const confirmed = await confirmDialog(
      buildDangerConfirmDialog({
        title: "Hard delete trip",
        message: `Hard-delete ${trip.title || trip.trip_id}? This cannot be undone.`,
        confirmLabel: "Hard delete",
      }),
    );
    if (!confirmed) return;

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      await adminHardDeleteTrip(trip.trip_id);
      setMessage("Trip permanently deleted.");
      if (selectedTripDrawerId === trip.trip_id) {
        setIsTripDrawerOpen(false);
        setSelectedTripDrawerId(null);
      }
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not hard-delete trip.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetTripFilters = () => {
    setStatusFilters([]);
    setGenerationStateFilters([]);
    setExpirationFilters([]);
    setSourceFilters([]);
    setVisibleColumns([...DEFAULT_VISIBLE_TRIP_COLUMNS]);
    setSortColumn(DEFAULT_TRIP_SORT_COLUMN);
    setSortDirection(DEFAULT_TRIP_SORT_DIRECTION);
    setPage(1);
  };

  const handleSortChange = (column: TripSortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection(
        column === "updated" ||
          column === "created" ||
          column === "expires" ||
          column === "archived"
          ? "desc"
          : "asc",
      );
      setPage(1);
      return;
    }
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    setPage(1);
  };

  const isTripSortedColumn = (column: TripSortColumn): boolean =>
    sortColumn === column;

  const openOwnerDrawer = (ownerId: string) => {
    setSelectedTripDrawerId(null);
    setIsTripDrawerOpen(false);
    setSelectedOwnerId(ownerId);
    setIsOwnerDrawerOpen(true);
  };

  const openTripDrawer = (tripId: string) => {
    setSelectedOwnerId(null);
    setSelectedOwnerProfile(null);
    setIsOwnerDrawerOpen(false);
    setSelectedTripDrawerId(tripId);
    setIsTripDrawerOpen(true);
  };

  const toggleTripSelection = (tripId: string, checked: boolean) => {
    setSelectedTripIds((current) => {
      const next = new Set(current);
      if (checked) next.add(tripId);
      else next.delete(tripId);
      return next;
    });
  };

  const toggleSelectAllVisibleTrips = (checked: boolean) => {
    setSelectedTripIds((current) => {
      const next = new Set(current);
      if (!checked) {
        visibleTrips.forEach((trip) => next.delete(trip.trip_id));
        return next;
      }
      visibleTrips.forEach((trip) => next.add(trip.trip_id));
      return next;
    });
  };

  const handleBulkSoftDeleteTrips = async () => {
    if (selectedVisibleTrips.length === 0) return;
    const confirmed = await confirmDialog(
      buildDangerConfirmDialog({
        title: "Soft delete selected trips",
        message: `Archive ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? "" : "s"}?`,
        confirmLabel: "Archive",
      }),
    );
    if (!confirmed) return;
    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      await Promise.all(
        selectedVisibleTrips.map((trip) =>
          adminUpdateTrip(trip.trip_id, { status: "archived" }),
        ),
      );
      setMessage(
        `${selectedVisibleTrips.length} trip${selectedVisibleTrips.length === 1 ? "" : "s"} archived.`,
      );
      setSelectedTripIds(new Set());
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not archive selected trips.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkHardDeleteTrips = async () => {
    if (selectedVisibleTrips.length === 0) return;
    const confirmed = await confirmDialog(
      buildDangerConfirmDialog({
        title: "Hard delete selected trips",
        message: `Hard-delete ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? "" : "s"}? This cannot be undone.`,
        confirmLabel: "Hard delete",
      }),
    );
    if (!confirmed) return;
    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      const results = await Promise.allSettled(
        selectedVisibleTrips.map((trip) => adminHardDeleteTrip(trip.trip_id)),
      );
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      const deleted = results.length - failed;
      if (deleted > 0) {
        setMessage(
          failed > 0
            ? `${deleted} trip${deleted === 1 ? "" : "s"} permanently deleted. ${failed} failed.`
            : `${deleted} trip${deleted === 1 ? "" : "s"} permanently deleted.`,
        );
      }
      if (failed > 0 && deleted === 0) {
        throw new Error("Could not hard-delete selected trips.");
      }
      setSelectedTripIds(new Set());
      await loadTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not hard-delete selected trips.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!deepLinkedOwnerId) {
      handledDeepLinkedOwnerIdRef.current = null;
      return;
    }
    if (handledDeepLinkedOwnerIdRef.current !== deepLinkedOwnerId) {
      setSelectedTripDrawerId(null);
      setIsTripDrawerOpen(false);
      setSelectedOwnerId(deepLinkedOwnerId);
      setIsOwnerDrawerOpen(true);
      handledDeepLinkedOwnerIdRef.current = deepLinkedOwnerId;
    }
  }, [deepLinkedOwnerId]);

  useEffect(() => {
    if (!deepLinkedTripId) {
      handledDeepLinkedTripIdRef.current = null;
      return;
    }
    if (handledDeepLinkedTripIdRef.current !== deepLinkedTripId) {
      setSelectedOwnerId(null);
      setSelectedOwnerProfile(null);
      setIsOwnerDrawerOpen(false);
      setSelectedTripDrawerId(deepLinkedTripId);
      setIsTripDrawerOpen(true);
      handledDeepLinkedTripIdRef.current = deepLinkedTripId;
    }

    const hasTripInList = trips.some(
      (trip) => trip.trip_id === deepLinkedTripId,
    );
    if (hasTripInList) return;

    let active = true;
    void adminListTrips({ search: deepLinkedTripId, limit: 20, status: "all" })
      .then((rows) => {
        if (!active) return;
        const exactMatch = rows.find((row) => row.trip_id === deepLinkedTripId);
        if (!exactMatch) return;
        setTrips((current) => {
          const exists = current.some(
            (candidate) => candidate.trip_id === exactMatch.trip_id,
          );
          const nextTrips = exists
            ? current.map((candidate) =>
                candidate.trip_id === exactMatch.trip_id
                  ? { ...candidate, ...exactMatch }
                  : candidate,
              )
            : [exactMatch, ...current];
          writeAdminCache(TRIPS_CACHE_KEY, nextTrips);
          return nextTrips;
        });
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load linked trip.",
        );
      });

    return () => {
      active = false;
    };
  }, [deepLinkedTripId, trips]);

  useEffect(() => {
    setSelectedTripIds((current) => {
      if (current.size === 0) return current;
      const allowed = new Set(visibleTrips.map((trip) => trip.trip_id));
      let changed = false;
      const next = new Set<string>();
      current.forEach((tripId) => {
        if (allowed.has(tripId)) {
          next.add(tripId);
          return;
        }
        changed = true;
      });
      return changed ? next : current;
    });
  }, [visibleTrips]);

  useEffect(() => {
    if (!isOwnerDrawerOpen || !selectedOwnerId) return;
    let active = true;
    setIsLoadingOwnerProfile(true);
    void adminGetUserProfile(selectedOwnerId)
      .then((profile) => {
        if (!active) return;
        setSelectedOwnerProfile(profile);
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load owner profile.",
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingOwnerProfile(false);
      });
    return () => {
      active = false;
    };
  }, [isOwnerDrawerOpen, selectedOwnerId]);

  useEffect(() => {
    const root = tripsTableScrollRef.current;
    const node = root?.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    );
    if (!node) return;
    const handleScroll = () => {
      setIsTripsTableScrolledHorizontally(node.scrollLeft > 4);
    };
    handleScroll();
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => node.removeEventListener("scroll", handleScroll);
  }, [visibleTrips.length]);

  return (
    <AdminShell
      title="Trip Lifecycle Controls"
      description="Inspect lifecycle, generation diagnostics, ownership, and expiration metadata."
      searchValue={searchValue}
      onSearchValueChange={(value) => {
        setSearchValue(value);
        setPage(1);
      }}
      dateRange={dateRange}
      onDateRangeChange={(value) => {
        setDateRange(value);
        setPage(1);
      }}
      actions={
        <AdminReloadButton
          onClick={() => void loadTrips()}
          isLoading={isLoading}
          label="Reload"
        />
      }
    >
      {errorMessage && (
        <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {errorMessage}
        </section>
      )}
      {dataSourceNotice && (
        <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dataSourceNotice}
        </section>
      )}
      {message && (
        <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            <AdminCountUpNumber value={summary.total} />
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            <AdminCountUpNumber value={summary.active} />
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Expired
          </p>
          <p className="mt-2 text-2xl font-black text-amber-700">
            <AdminCountUpNumber value={summary.expired} />
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Archived
          </p>
          <p className="mt-2 text-2xl font-black text-slate-700">
            <AdminCountUpNumber value={summary.archived} />
          </p>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
            Failed generation
          </p>
          <p className="mt-2 text-2xl font-black text-rose-700">
            <AdminCountUpNumber value={summary.failedGeneration} />
          </p>
          <button
            type="button"
            onClick={() => {
              setGenerationStateFilters(["failed"]);
              setPage(1);
            }}
            className="mt-2 inline-flex h-7 items-center rounded-md border border-rose-300 bg-white px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
          >
            Filter failed
          </button>
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Trips</h2>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <AdminFilterMenu
              label="Status"
              options={statusFilterOptions}
              selectedValues={statusFilters}
              onSelectedValuesChange={(next) => {
                setStatusFilters(next as TripStatus[]);
                setPage(1);
              }}
            />
            <AdminFilterMenu
              label="Generation"
              options={generationFilterOptions}
              selectedValues={generationStateFilters}
              onSelectedValuesChange={(next) => {
                setGenerationStateFilters(next as TripGenerationState[]);
                setPage(1);
              }}
            />
            <AdminFilterMenu
              label="Expiration"
              options={expirationFilterOptions}
              selectedValues={expirationFilters}
              onSelectedValuesChange={(next) => {
                setExpirationFilters(next as TripExpirationFilter[]);
                setPage(1);
              }}
            />
            <AdminFilterMenu
              label="Source"
              options={sourceFilterOptions}
              selectedValues={sourceFilters}
              onSelectedValuesChange={(next) => {
                setSourceFilters(next);
                setPage(1);
              }}
            />
            <AdminFilterMenu
              label="Columns"
              options={visibleTripColumnOptions}
              selectedValues={visibleColumns}
              onSelectedValuesChange={(next) => {
                setVisibleColumns(sanitizeTripVisibleColumns(next));
                setPage(1);
              }}
            />
            <button
              type="button"
              onClick={resetTripFilters}
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <X size={14} />
              Reset
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-700">
            {selectedVisibleTrips.length} selected
          </span>
          <button
            type="button"
            onClick={() => void handleBulkSoftDeleteTrips()}
            disabled={isSaving || selectedVisibleTrips.length === 0}
            className="inline-flex h-8 items-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Soft-delete selected
          </button>
          <button
            type="button"
            onClick={() => void handleBulkHardDeleteTrips()}
            disabled={isSaving || selectedVisibleTrips.length === 0}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash size={12} />
            Hard delete selected
          </button>
          {selectedVisibleTrips.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTripIds(new Set())}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>

        <div
          ref={tripsTableScrollRef}
          className="rounded-xl border border-slate-200 bg-white"
        >
          <Table className="w-[max(100%,1160px)]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead
                  className={`sticky left-0 z-40 w-[56px] min-w-[56px] max-w-[56px] px-4 py-3 ${getAdminStickyHeaderCellClass(
                    {
                      isScrolled: isTripsTableScrolledHorizontally,
                      isFirst: hasStickyTripColumnPair,
                    },
                  )}`}
                  style={{ width: 56, minWidth: 56, maxWidth: 56 }}
                >
                  <Checkbox
                    checked={
                      areAllVisibleTripsSelected
                        ? true
                        : isVisibleTripSelectionPartial
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) =>
                      toggleSelectAllVisibleTrips(Boolean(checked))
                    }
                    aria-label="Select all visible trips"
                  />
                </TableHead>
                <TableHead
                  className={`sticky left-[56px] z-30 w-[340px] min-w-[340px] max-w-[340px] px-4 py-3 font-semibold text-slate-700 ${getAdminStickyHeaderCellClass(
                    {
                      isScrolled: isTripsTableScrolledHorizontally,
                      isFirst: false,
                      isSorted: isTripSortedColumn("trip"),
                    },
                  )}`}
                  style={{ width: 340, minWidth: 340, maxWidth: 340 }}
                >
                  <AdminSortHeaderButton
                    label="Trip"
                    isActive={isTripSortedColumn("trip")}
                    direction={sortDirection}
                    onClick={() => handleSortChange("trip")}
                  />
                </TableHead>
                {isTripColumnVisible("owner") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("owner") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Owner"
                      isActive={isTripSortedColumn("owner")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("owner")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("lifecycle") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("lifecycle") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Lifecycle"
                      isActive={isTripSortedColumn("lifecycle")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("lifecycle")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("generation") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("generation") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Generation"
                      isActive={isTripSortedColumn("generation")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("generation")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("source") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("source") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Source"
                      isActive={isTripSortedColumn("source")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("source")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("expires") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("expires") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Expires"
                      isActive={isTripSortedColumn("expires")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("expires")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("updated") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("updated") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Last update"
                      isActive={isTripSortedColumn("updated")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("updated")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("created") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("created") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Created"
                      isActive={isTripSortedColumn("created")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("created")}
                    />
                  </TableHead>
                )}
                {isTripColumnVisible("archived") && (
                  <TableHead
                    className={`px-4 py-3 font-semibold text-slate-700 ${isTripSortedColumn("archived") ? ADMIN_TABLE_SORTED_HEADER_CLASS : ""}`}
                  >
                    <AdminSortHeaderButton
                      label="Archived at"
                      isActive={isTripSortedColumn("archived")}
                      direction={sortDirection}
                      onClick={() => handleSortChange("archived")}
                    />
                  </TableHead>
                )}
                <TableHead className="px-4 py-3 text-right font-semibold text-slate-700">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTrips.map((trip) => {
                const generationState = resolveTripGenerationState(trip);
                const normalizedSource =
                  (trip.source_kind || "").trim() || "unknown";
                const hasExpiration = Boolean(
                  normalizeIsoTimestamp(trip.trip_expires_at),
                );
                const hasArchivedAt = Boolean(
                  normalizeIsoTimestamp(trip.archived_at),
                );
                return (
                  <TableRow
                    key={trip.trip_id}
                    className={ADMIN_TABLE_ROW_SURFACE_CLASS}
                    data-state={
                      selectedTripIds.has(trip.trip_id) ? "selected" : undefined
                    }
                  >
                    <TableCell
                      className={`sticky left-0 z-40 w-[56px] min-w-[56px] max-w-[56px] px-4 py-3 ${getAdminStickyBodyCellClass(
                        {
                          isSelected: selectedTripIds.has(trip.trip_id),
                          isScrolled: isTripsTableScrolledHorizontally,
                          isFirst: hasStickyTripColumnPair,
                        },
                      )}`}
                      style={{ width: 56, minWidth: 56, maxWidth: 56 }}
                    >
                      <Checkbox
                        checked={selectedTripIds.has(trip.trip_id)}
                        onCheckedChange={(checked) =>
                          toggleTripSelection(trip.trip_id, Boolean(checked))
                        }
                        aria-label={`Select trip ${trip.title || trip.trip_id}`}
                      />
                    </TableCell>
                    <TableCell
                      className={`sticky left-[56px] z-30 w-[340px] min-w-[340px] max-w-[340px] cursor-pointer px-4 py-3 ${getAdminStickyBodyCellClass(
                        {
                          isSelected: selectedTripIds.has(trip.trip_id),
                          isScrolled: isTripsTableScrolledHorizontally,
                          isFirst: false,
                          isSorted: isTripSortedColumn("trip"),
                        },
                      )}`}
                      style={{ width: 340, minWidth: 340, maxWidth: 340 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openTripDrawer(trip.trip_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openTripDrawer(trip.trip_id);
                        }
                      }}
                    >
                      <div
                        title="Open trip details drawer"
                        className="inline-flex xl:max-w-full items-center gap-1.5 truncate text-left text-sm font-semibold text-slate-800 group-hover:text-accent-700 group-hover:underline"
                      >
                        <span className="truncate">
                          {trip.title || trip.trip_id}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        <CopyableUuid
                          value={trip.trip_id}
                          textClassName="max-w-full truncate text-xs"
                          hintClassName="text-[9px]"
                        />
                      </div>
                    </TableCell>
                    {isTripColumnVisible("owner") && (
                      <TableCell
                        className={`max-w-[240px] px-4 py-3 text-xs text-slate-600 ${isTripSortedColumn("owner") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => openOwnerDrawer(trip.owner_id)}
                          title="Open owner details"
                          className="group block w-full cursor-pointer text-left"
                        >
                          <span className="block truncate text-sm font-medium text-slate-700 group-hover:text-accent-700 group-hover:underline">
                            {trip.owner_email || trip.owner_id}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            <CopyableUuid
                              value={trip.owner_id}
                              focusable={false}
                              textClassName="max-w-full truncate text-[11px]"
                              hintClassName="text-[9px]"
                            />
                          </span>
                        </button>
                      </TableCell>
                    )}
                    {isTripColumnVisible("lifecycle") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("lifecycle") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getLifecyclePillClassName(trip.status)}`}
                        >
                          {trip.status}
                        </span>
                      </TableCell>
                    )}
                    {isTripColumnVisible("generation") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("generation") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getGenerationPillClassName(generationState)}`}
                        >
                          {getGenerationStateLabel(generationState)}
                        </span>
                      </TableCell>
                    )}
                    {isTripColumnVisible("source") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("source") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <div className="text-xs font-medium text-slate-700">
                          {formatSourceKindLabel(normalizedSource)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {normalizedSource}
                        </div>
                      </TableCell>
                    )}
                    {isTripColumnVisible("expires") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("expires") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <div className="text-xs font-semibold text-slate-700">
                          {formatRelativeTimestamp(
                            trip.trip_expires_at,
                            "No expiration",
                          )}
                        </div>
                        {hasExpiration && (
                          <div className="text-[11px] text-slate-500">
                            {formatTimestamp(trip.trip_expires_at, "Not set")}
                          </div>
                        )}
                      </TableCell>
                    )}
                    {isTripColumnVisible("updated") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("updated") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <div className="text-xs font-semibold text-slate-700">
                          {formatRelativeTimestamp(
                            trip.updated_at,
                            "No update",
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatTimestamp(trip.updated_at, "No update")}
                        </div>
                      </TableCell>
                    )}
                    {isTripColumnVisible("created") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("created") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <div className="text-xs font-semibold text-slate-700">
                          {formatRelativeTimestamp(
                            trip.created_at,
                            "No timestamp",
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatTimestamp(trip.created_at, "No timestamp")}
                        </div>
                      </TableCell>
                    )}
                    {isTripColumnVisible("archived") && (
                      <TableCell
                        className={`px-4 py-3 ${isTripSortedColumn("archived") ? ADMIN_TABLE_SORTED_CELL_CLASS : ""}`}
                      >
                        <div className="text-xs font-semibold text-slate-700">
                          {formatRelativeTimestamp(
                            trip.archived_at,
                            "Not archived",
                          )}
                        </div>
                        {hasArchivedAt && (
                          <div className="text-[11px] text-slate-500">
                            {formatTimestamp(trip.archived_at, "Not archived")}
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3 text-right">
                      <TripRowActionsMenu
                        trip={trip}
                        disabled={isSaving}
                        onPreviewTrip={handleOpenTripPreview}
                        onDuplicateTrip={(candidate) => {
                          void handleDuplicateTrip(candidate);
                        }}
                        onTransferTrip={(candidate) => {
                          void handleTransferTrip(candidate);
                        }}
                        onDownloadTripJson={(candidate) => {
                          void handleDownloadTripJson(candidate);
                        }}
                        onSoftDeleteTrip={(candidate) => {
                          void handleSoftDeleteTrip(candidate);
                        }}
                        onHardDeleteTrip={(candidate) => {
                          void handleHardDeleteTrip(candidate);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedVisibleTrips.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell
                    className="px-4 py-8 text-center text-sm text-slate-500"
                    colSpan={tripsTableColumnCount}
                  >
                    No trips match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {isLoading && (
                <TableRow>
                  <TableCell
                    className="px-4 py-8 text-center text-sm text-slate-500"
                    colSpan={tripsTableColumnCount}
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <SpinnerGap
                        size={16}
                        className="animate-spin text-slate-400"
                      />
                      Loading trips...
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {sortedVisibleTrips.length === 0
              ? "Showing 0 trips"
              : `Showing ${(page - 1) * TRIPS_PAGE_SIZE + 1}-${Math.min(page * TRIPS_PAGE_SIZE, sortedVisibleTrips.length)} of ${sortedVisibleTrips.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page === 1}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {page} / {tripPageCount}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(current + 1, tripPageCount))
              }
              disabled={page >= tripPageCount}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        {isSaving && (
          <p className="mt-2 text-xs text-slate-500">Saving changes...</p>
        )}
      </section>

      <Drawer
        open={isTripDrawerOpen}
        onOpenChange={(open) => {
          setIsTripDrawerOpen(open);
          if (!open) {
            setSelectedTripDrawerId(null);
            if (
              searchParams.has("trip") ||
              searchParams.get("drawer") === "trip"
            ) {
              const next = new URLSearchParams(searchParams);
              next.delete("trip");
              next.delete("drawer");
              setSearchParams(next, { replace: true });
            }
          }
        }}
        direction="right"
      >
        <DrawerContent
          side="right"
          className="w-[min(96vw,560px)] p-0"
          accessibleTitle={
            selectedTripForDrawer
              ? selectedTripForDrawer.title || selectedTripForDrawer.trip_id
              : "Trip details"
          }
          accessibleDescription="Inspect selected trip metadata and jump to related owner details."
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-black text-slate-900">
                Trip details
              </h2>
              <p className="truncate text-sm text-slate-600">
                {selectedTripForDrawer
                  ? selectedTripForDrawer.title || selectedTripForDrawer.trip_id
                  : "No trip selected"}
              </p>
              {selectedTripForDrawer && (
                <button
                  type="button"
                  onClick={() => handleOpenTripPreview(selectedTripForDrawer)}
                  className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-accent-300 bg-accent-50 px-3 text-sm font-semibold text-accent-800 hover:bg-accent-100"
                >
                  Open trip page
                  <ArrowSquareOut size={14} />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedTripForDrawer ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No trip found for the selected audit target.
                </div>
              ) : (
                <div className="space-y-4">
                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Trip Information
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Trip ID
                        </span>
                        <CopyableUuid
                          value={selectedTripForDrawer.trip_id}
                          textClassName="break-all text-sm font-medium text-slate-800"
                        />
                      </div>
                      <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Owner ID
                        </span>
                        <div className="flex flex-col gap-2">
                          <CopyableUuid
                            value={selectedTripForDrawer.owner_id}
                            textClassName="break-all text-sm font-medium text-slate-800"
                          />
                          <span className="text-xs text-slate-600">
                            {selectedTripForDrawer.owner_email ||
                              "No owner email"}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openOwnerDrawer(selectedTripForDrawer.owner_id)
                              }
                              className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              View owner
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleTransferTrip(selectedTripForDrawer);
                              }}
                              disabled={isSaving}
                              className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Transfer owner
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Lifecycle
                        </span>
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getLifecyclePillClassName(selectedTripForDrawer.status)}`}
                        >
                          {selectedTripForDrawer.status}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Generation
                        </span>
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getGenerationPillClassName(selectedTripGenerationState)}`}
                        >
                          {getGenerationStateLabel(selectedTripGenerationState)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Source
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatSourceKindLabel(
                            selectedTripForDrawer.source_kind,
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {(selectedTripForDrawer.source_kind || "").trim() ||
                            "unknown"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Created At
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatRelativeTimestamp(
                            selectedTripForDrawer.created_at,
                            "n/a",
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatTimestamp(
                            selectedTripForDrawer.created_at,
                            "n/a",
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Updated At
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatRelativeTimestamp(
                            selectedTripForDrawer.updated_at,
                            "n/a",
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatTimestamp(
                            selectedTripForDrawer.updated_at,
                            "n/a",
                          )}
                        </span>
                      </div>
                      <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Expires At
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatRelativeTimestamp(
                            selectedTripForDrawer.trip_expires_at,
                            "No expiration",
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatTimestamp(
                            selectedTripForDrawer.trip_expires_at,
                            "No expiration",
                          )}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Lifecycle Controls
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-500">
                          Lifecycle status
                        </span>
                        <Select
                          value={drawerLifecycleDraft}
                          onValueChange={(value) => {
                            setDrawerLifecycleDraft(value as TripStatus);
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label
                        htmlFor="trip-lifecycle-expiration"
                        className="flex flex-col gap-1"
                      >
                        <span className="text-xs font-semibold text-slate-500">
                          Expiration timestamp
                        </span>
                        <input
                          id="trip-lifecycle-expiration"
                          type="datetime-local"
                          value={drawerExpirationDraft}
                          onChange={(event) => {
                            setDrawerExpirationDraft(event.target.value);
                          }}
                          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm shadow-black/5"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-600">
                        Changes here are applied only after you save.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveDrawerLifecycle();
                        }}
                        disabled={isSaving || !hasDrawerLifecycleChanges}
                        className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save lifecycle settings
                      </button>
                    </div>
                  </section>

                  {isLoadingFullTrip ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                      Loading trip map and itinerary...
                    </div>
                  ) : selectedFullTrip &&
                    (previewCityStops.length > 0 || previewMapUrl) ? (
                    <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <div className="grid grid-cols-2">
                        <div className="border-r border-gray-100 p-3.5">
                          <div className="space-y-0 h-48 overflow-y-auto">
                            {previewCityStops.length === 0 ? (
                              <div className="text-[11px] text-gray-400">
                                No city stops found
                              </div>
                            ) : (
                              previewCityStops.map((stop, idx) => {
                                const isStart = idx === 0;
                                const isEnd =
                                  idx === previewCityStops.length - 1;
                                const pinClass =
                                  isStart && !isEnd
                                    ? "text-indigo-500"
                                    : isEnd && !isStart
                                      ? "text-indigo-300"
                                      : "text-indigo-500";
                                return (
                                  <div
                                    key={stop.id}
                                    className="flex min-h-[31px] items-center gap-2.5 px-2"
                                  >
                                    <div className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
                                      {previewCityStops.length > 1 && (
                                        <span
                                          className={`absolute left-1/2 w-0.5 -translate-x-1/2 bg-indigo-200 ${
                                            isStart
                                              ? "top-1/2 -bottom-px"
                                              : isEnd
                                                ? "-top-px bottom-1/2"
                                                : "-top-px -bottom-px"
                                          }`}
                                        />
                                      )}
                                      {isStart || isEnd ? (
                                        <MapPin
                                          weight="fill"
                                          size={13}
                                          className={`relative z-10 ${pinClass}`}
                                        />
                                      ) : (
                                        <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                      )}
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                      <span className="break-words text-[15px] font-medium leading-5 text-gray-700">
                                        {stop.title}
                                      </span>
                                      <span className="text-[12px] font-medium leading-5 text-indigo-500/75">
                                        {Math.max(1, Math.ceil(stop.duration))}{" "}
                                        nights
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-2">
                          <div className="relative h-48 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                            {previewMapUrl ? (
                              <img
                                src={previewMapUrl}
                                alt={`Map preview for ${selectedFullTrip.title}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] text-gray-500">
                                Map preview unavailable
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                      Trip preview is unavailable for this record.
                    </div>
                  )}

                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Generation Diagnostics
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getGenerationPillClassName(selectedTripGenerationState)}`}
                      >
                        {getGenerationStateLabel(selectedTripGenerationState)}
                      </span>
                    </div>
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">
                          Retries
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          {selectedTripRetryCount}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">
                          Dead-letter jobs
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          {selectedTripDeadLetterJobCount}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">
                          Latest state transition
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          {selectedTripGenerationMeta?.lastFailedAt
                            ? `${formatRelativeTimestamp(selectedTripGenerationMeta.lastFailedAt, "n/a")} (${formatTimestamp(selectedTripGenerationMeta.lastFailedAt, "n/a")})`
                            : selectedTripGenerationMeta?.lastSucceededAt
                              ? `${formatRelativeTimestamp(selectedTripGenerationMeta.lastSucceededAt, "n/a")} (${formatTimestamp(selectedTripGenerationMeta.lastSucceededAt, "n/a")})`
                              : "n/a"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">
                          Retry requested at
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          {selectedTripGenerationMeta?.retryRequestedAt
                            ? `${formatRelativeTimestamp(selectedTripGenerationMeta.retryRequestedAt, "n/a")} (${formatTimestamp(selectedTripGenerationMeta.retryRequestedAt, "n/a")})`
                            : "n/a"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">
                          Input snapshot
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          {selectedTripGenerationMeta?.inputSnapshot
                            ? `${selectedTripGenerationMeta.inputSnapshot.flow} (${formatTimestamp(selectedTripGenerationMeta.inputSnapshot.createdAt, "n/a")})`
                            : "Unavailable"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">
                          Latest queue job
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          {selectedTripLatestGenerationJob
                            ? `${selectedTripLatestGenerationJob.state} (${formatRelativeTimestamp(selectedTripLatestGenerationJob.createdAt, "n/a")})`
                            : "n/a"}
                        </dd>
                      </div>
                    </dl>
                    {isLoadingTripAttemptLogRows && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Loading attempt history...
                      </div>
                    )}
                    {selectedTripLatestAttempt ? (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Flow
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.flow}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Attempt source
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.source}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Provider
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.provider || "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Model
                          </dt>
                          <dd className="mt-1 break-all text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.model || "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Provider model
                          </dt>
                          <dd className="mt-1 break-all text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.providerModel || "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            HTTP status
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {typeof selectedTripLatestAttempt.statusCode ===
                            "number"
                              ? selectedTripLatestAttempt.statusCode
                              : "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Request ID
                          </dt>
                          <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                            {selectedTripLatestAttempt.requestId || "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Execution mode
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripOrchestrationMode || "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Duration
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {formatDurationMs(
                              selectedTripLatestAttempt.durationMs,
                            )}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Started at
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {formatRelativeTimestamp(
                              selectedTripLatestAttempt.startedAt,
                              "n/a",
                            )}{" "}
                            (
                            {formatTimestamp(
                              selectedTripLatestAttempt.startedAt,
                              "n/a",
                            )}
                            )
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Finished at
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.finishedAt
                              ? `${formatRelativeTimestamp(selectedTripLatestAttempt.finishedAt, "n/a")} (${formatTimestamp(selectedTripLatestAttempt.finishedAt, "n/a")})`
                              : "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Attempt outcome
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttemptOutcome}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Provider reached
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {typeof selectedTripLatestAttemptProviderReached ===
                            "boolean"
                              ? selectedTripLatestAttemptProviderReached
                                ? "yes"
                                : "no"
                              : "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Failure kind
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.failureKind || "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Error code
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.errorCode || "n/a"}
                          </dd>
                        </div>
                        <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Error message
                          </dt>
                          <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                            {selectedTripLatestAttempt.errorMessage || "n/a"}
                          </dd>
                        </div>
                        <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Attempt metadata details
                          </dt>
                          <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                            {selectedTripLatestAttemptDetails || "n/a"}
                          </dd>
                        </div>
                        {selectedTripLatestAttemptSecurity && (
                          <>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Guard decision
                              </dt>
                              <dd className="mt-1 text-sm font-medium text-slate-800">
                                {
                                  selectedTripLatestAttemptSecurity.guardDecision
                                }
                              </dd>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Risk score
                              </dt>
                              <dd className="mt-1 text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.riskScore}
                              </dd>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Security stage
                              </dt>
                              <dd className="mt-1 text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.stage}
                              </dd>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Security blocked
                              </dt>
                              <dd className="mt-1 text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.blocked
                                  ? "yes"
                                  : "no"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Flagged fields
                              </dt>
                              <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.flaggedFields
                                  .length > 0
                                  ? selectedTripLatestAttemptSecurity.flaggedFields.join(
                                      ", ",
                                    )
                                  : "n/a"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Attack categories
                              </dt>
                              <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity
                                  .attackCategories.length > 0
                                  ? selectedTripLatestAttemptSecurity.attackCategories.join(
                                      ", ",
                                    )
                                  : "n/a"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Matched rules
                              </dt>
                              <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.matchedRules
                                  .length > 0
                                  ? selectedTripLatestAttemptSecurity.matchedRules.join(
                                      ", ",
                                    )
                                  : "n/a"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Redacted excerpt
                              </dt>
                              <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.redactedExcerpt ||
                                  "n/a"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Prompt fingerprint
                              </dt>
                              <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                                {selectedTripLatestAttemptSecurity.promptFingerprintSha256 ||
                                  "n/a"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <dt className="text-xs font-semibold text-slate-500">
                                Sanitization
                              </dt>
                              <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                                {selectedTripLatestAttemptSecurity.sanitization
                                  ?.applied
                                  ? `applied (${selectedTripLatestAttemptSecurity.sanitization.changedFields.join(", ") || "fields unavailable"})`
                                  : "not applied"}
                              </dd>
                            </div>
                          </>
                        )}
                      </dl>
                    ) : (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        No generation attempts captured yet.
                      </div>
                    )}
                    {selectedTripLatestGenerationJob && (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Job started at
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestGenerationJob.startedAt
                              ? `${formatRelativeTimestamp(selectedTripLatestGenerationJob.startedAt, "n/a")} (${formatTimestamp(selectedTripLatestGenerationJob.startedAt, "n/a")})`
                              : "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Job finished at
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">
                            {selectedTripLatestGenerationJob.finishedAt
                              ? `${formatRelativeTimestamp(selectedTripLatestGenerationJob.finishedAt, "n/a")} (${formatTimestamp(selectedTripLatestGenerationJob.finishedAt, "n/a")})`
                              : "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Job last error code
                          </dt>
                          <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                            {selectedTripLatestGenerationJob.lastErrorCode ||
                              "n/a"}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <dt className="text-xs font-semibold text-slate-500">
                            Job last error message
                          </dt>
                          <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                            {selectedTripLatestGenerationJob.lastErrorMessage ||
                              "n/a"}
                          </dd>
                        </div>
                      </dl>
                    )}
                    {selectedTripGenerationAttempts.length > 0 && (
                      <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Recent attempts
                        </p>
                        {selectedTripGenerationAttempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-white px-2 py-1 text-[11px]"
                          >
                            <span className="font-semibold text-slate-700">
                              {attempt.state}
                            </span>
                            <span className="truncate text-slate-600">
                              {attempt.model || attempt.providerModel || "n/a"}
                            </span>
                            <span className="truncate text-slate-500">
                              {formatRelativeTimestamp(
                                attempt.startedAt,
                                "n/a",
                              )}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              {formatDurationMs(attempt.durationMs)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isLoadingTripGenerationJobRows && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Loading queue/dead-letter jobs...
                      </div>
                    )}
                    {selectedTripGenerationJobRows.length > 0 && (
                      <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Queue jobs
                        </p>
                        {selectedTripGenerationJobRows.map((job) => (
                          <div
                            key={job.id}
                            className="grid gap-1 rounded-md border border-slate-100 bg-white px-2 py-1.5 text-[11px] sm:grid-cols-[auto,1fr,auto,auto,auto] sm:items-center sm:gap-2"
                          >
                            <span
                              className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 font-semibold ${getGenerationJobPillClassName(job.state)}`}
                            >
                              {job.state}
                            </span>
                            <span className="truncate text-slate-600">
                              {job.lastErrorCode ||
                                job.lastErrorMessage ||
                                job.attemptId}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              r{job.retryCount}/{job.maxRetries}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              {formatRelativeTimestamp(job.createdAt, "n/a")}
                            </span>
                            {job.state === "dead" || job.state === "failed" ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleRequeueGenerationJob(job);
                                }}
                                disabled={requeueingGenerationJobId === job.id}
                                className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {requeueingGenerationJobId === job.id ? (
                                  <>
                                    <SpinnerGap
                                      size={12}
                                      className="mr-1 animate-spin"
                                    />
                                    Requeueing...
                                  </>
                                ) : (
                                  "Requeue"
                                )}
                              </button>
                            ) : (
                              <span
                                className="hidden sm:block"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedTripLatestAttemptMetadata ||
                      selectedTripLatestGenerationJobPayload ||
                      selectedTripRequestPayload ||
                      selectedTripInputSnapshot) && (
                      <div className="space-y-2">
                        {selectedTripLatestAttemptMetadata && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Attempt metadata JSON
                            </p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-[10px] text-slate-100">
                              {JSON.stringify(
                                selectedTripLatestAttemptMetadata,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}
                        {selectedTripLatestGenerationJobPayload && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Latest queue job payload JSON
                            </p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-[10px] text-slate-100">
                              {JSON.stringify(
                                selectedTripLatestGenerationJobPayload,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}
                        {selectedTripRequestPayload && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Request payload JSON
                            </p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-[10px] text-slate-100">
                              {JSON.stringify(
                                selectedTripRequestPayload,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}
                        {selectedTripInputSnapshot && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Input snapshot JSON
                            </p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-[10px] text-slate-100">
                              {JSON.stringify(
                                selectedTripInputSnapshot,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      {ACTIVE_RETRY_MODEL_OPTIONS.length > 0 && (
                        <div className="max-w-sm">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Retry model
                          </p>
                          {selectedDrawerRetryModelOption && (
                            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-800">
                              <AiProviderLogo
                                provider={
                                  selectedDrawerRetryModelOption.provider
                                }
                                model={selectedDrawerRetryModelOption.model}
                                size={12}
                              />
                              <span>
                                {selectedDrawerRetryModelOption.providerLabel} ·{" "}
                                {selectedDrawerRetryModelOption.model}
                              </span>
                              <span className="rounded-full border border-accent-300 bg-white px-1.5 text-[10px] uppercase tracking-wide text-accent-700">
                                current
                              </span>
                            </div>
                          )}
                          <Select
                            value={drawerRetryModelId}
                            onValueChange={setDrawerRetryModelId}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {groupedRetryModelOptions.map((group) => (
                                <SelectGroup
                                  key={`drawer-model-group-${group.providerLabel}`}
                                >
                                  <SelectLabel>
                                    {group.providerLabel}
                                  </SelectLabel>
                                  {group.options.map((option) => (
                                    <SelectItem
                                      key={option.id}
                                      value={option.id}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <AiProviderLogo
                                          provider={option.provider}
                                          model={option.model}
                                          size={14}
                                        />
                                        <span className="font-medium text-slate-800">
                                          {option.model}
                                        </span>
                                        {option.id === drawerRetryModelId && (
                                          <span className="rounded-full border border-accent-300 bg-accent-50 px-1.5 text-[10px] uppercase tracking-wide text-accent-700">
                                            current
                                          </span>
                                        )}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <span
                        className="inline-flex"
                        title={
                          drawerRetryDisabledReason ||
                          "Retry generation with the selected model"
                        }
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void handleRetryTripGeneration();
                          }}
                          disabled={!canRetryGenerationInDrawer}
                          className="inline-flex items-center rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isRetryingGeneration
                            ? "Retrying generation..."
                            : "Retry generation"}
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenBenchmarkFromDrawer}
                        disabled={!selectedTripGenerationMeta?.inputSnapshot}
                        className="ml-2 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Open in AI Benchmark
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Trip Actions
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenTripPreview(selectedTripForDrawer)
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        Preview trip
                        <ArrowSquareOut size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDownloadTripJson(selectedTripForDrawer);
                        }}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Download JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDuplicateTrip(selectedTripForDrawer);
                        }}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Duplicate trip
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleTransferTrip(selectedTripForDrawer);
                        }}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Transfer owner
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSoftDeleteTrip(selectedTripForDrawer);
                        }}
                        disabled={isSaving}
                        className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selectedTripForDrawer.status === "archived"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        {selectedTripForDrawer.status === "archived"
                          ? "Restore trip"
                          : "Soft-delete trip"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleHardDeleteTrip(selectedTripForDrawer);
                        }}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Hard delete
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isOwnerDrawerOpen}
        onOpenChange={(open) => {
          setIsOwnerDrawerOpen(open);
          if (!open) {
            setSelectedOwnerId(null);
            setSelectedOwnerProfile(null);
            if (
              searchParams.has("user") ||
              searchParams.get("drawer") === "user"
            ) {
              const next = new URLSearchParams(searchParams);
              next.delete("user");
              next.delete("drawer");
              setSearchParams(next, { replace: true });
            }
          }
        }}
        direction="right"
      >
        <DrawerContent
          side="right"
          className="w-[min(96vw,560px)] p-0"
          accessibleTitle="Owner details"
          accessibleDescription="View selected trip owner identity and account context."
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-black text-slate-900">
                Owner details
              </h2>
              <p className="truncate text-sm text-slate-600">
                {selectedOwnerId ? (
                  <CopyableUuid
                    value={selectedOwnerId}
                    textClassName="max-w-[360px] truncate text-sm"
                  />
                ) : (
                  "No owner selected"
                )}
              </p>
              {selectedOwnerId && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/admin/users?user=${encodeURIComponent(selectedOwnerId)}&drawer=user`,
                    )
                  }
                  className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-accent-300 bg-accent-50 px-3 text-sm font-semibold text-accent-800 hover:bg-accent-100"
                >
                  Open user profile
                  <ArrowSquareOut size={14} />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingOwnerProfile ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Loading owner profile...
                </div>
              ) : selectedOwnerProfile ? (
                <div className="space-y-4">
                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Identity Context
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          User ID
                        </span>
                        <CopyableUuid
                          value={selectedOwnerProfile.user_id}
                          textClassName="break-all text-sm font-medium text-slate-800"
                        />
                      </div>
                      <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Email Address
                        </span>
                        <span className="break-all text-sm font-medium text-slate-800">
                          {selectedOwnerProfile.email || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Display Name
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {getUserDisplayName(selectedOwnerProfile) || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Role
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {selectedOwnerProfile.system_role === "admin"
                            ? "Admin"
                            : "User"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Tier
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {selectedOwnerProfile.tier_key || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-semibold text-slate-500">
                          Status
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatAccountStatusLabel(
                            selectedOwnerProfile.account_status,
                          )}
                        </span>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/admin/users?user=${encodeURIComponent(selectedOwnerProfile.user_id)}&drawer=user`,
                        )
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                    >
                      View Full Profile
                      <ArrowSquareOut size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No owner profile found.
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </AdminShell>
  );
};
