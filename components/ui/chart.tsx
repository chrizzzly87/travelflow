import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// shadcn/ui chart (Recharts 2.x). Series colours come from a `ChartConfig` and
// are exposed as `--color-<key>` on the container, so marks reference
// `var(--color-<key>)` and follow the theme without per-chart dark variants.

const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

// forwardRef, not a ref-in-props function component: preact/compat drops `ref`
// on plain function components.
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${toCssKey(key)}: ${color};` : null
  })
  .filter(Boolean)
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

/** Series keys are often human labels ("Active trips"); CSS custom properties need a slug. */
function toCssKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "-")
}

/** `var(--color-…)` for a config key, so marks don't hand-build the slug. */
function chartColor(key: string) {
  return `var(--color-${toCssKey(key)})`
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayloadItem = {
  name?: string | number
  value?: number | string | Array<number | string>
  dataKey?: string | number
  color?: string
  payload?: Record<string, unknown> & { fill?: string }
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  valueFormatter,
  nameKey,
  labelKey,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: React.ReactNode
  className?: string
  indicator?: "line" | "dot" | "dashed"
  hideLabel?: boolean
  hideIndicator?: boolean
  labelFormatter?: (label: React.ReactNode, payload: TooltipPayloadItem[]) => React.ReactNode
  valueFormatter?: (value: number | string) => React.ReactNode
  nameKey?: string
  labelKey?: string
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  const [firstItem] = payload
  const firstKey = `${labelKey || firstItem?.dataKey || firstItem?.name || "value"}`
  const firstConfig = getPayloadConfigFromPayload(config, firstItem, firstKey)
  const resolvedLabel =
    !labelKey && typeof label === "string"
      ? config[label]?.label || label
      : firstConfig?.label || label
  const tooltipLabel = hideLabel ? null : labelFormatter ? labelFormatter(resolvedLabel, payload) : resolvedLabel
  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/60 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl",
        className
      )}
    >
      {!nestLabel && tooltipLabel ? <div className="font-medium">{tooltipLabel}</div> : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)
          const indicatorColor = item.payload?.fill || item.color

          return (
            <div
              key={`${item.dataKey ?? index}`}
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center"
              )}
            >
              {itemConfig?.icon ? (
                <itemConfig.icon />
              ) : (
                !hideIndicator && (
                  <div
                    className={cn("shrink-0 rounded-[2px]", {
                      "size-2.5": indicator === "dot",
                      "w-1": indicator === "line",
                      "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                      "my-0.5": nestLabel && indicator === "dashed",
                    })}
                    style={{ backgroundColor: indicator === "dashed" ? undefined : indicatorColor, borderColor: indicatorColor }}
                  />
                )
              )}
              <div className={cn("flex flex-1 justify-between gap-4 leading-none", nestLabel ? "items-end" : "items-center")}>
                <div className="grid gap-1.5">
                  {nestLabel ? <div className="font-medium">{tooltipLabel}</div> : null}
                  <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                </div>
                {item.value !== undefined && item.value !== null && (
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {valueFormatter
                      ? valueFormatter(item.value as number | string)
                      : typeof item.value === "number"
                        ? item.value.toLocaleString()
                        : String(item.value)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: {
  className?: string
  hideIcon?: boolean
  payload?: Array<{ value?: string; dataKey?: string | number; color?: string }>
  verticalAlign?: "top" | "bottom" | "middle"
  nameKey?: string
}) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || item.value || "value"}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)

        return (
          <div key={`${item.value}`} className="flex items-center gap-1.5 text-muted-foreground [&>svg]:size-3">
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            )}
            {itemConfig?.label || item.value}
          </div>
        )
      })}
    </div>
  )
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? (payload.payload as Record<string, unknown>)
      : undefined

  let configLabelKey: string = key

  if (key in payload && typeof (payload as Record<string, unknown>)[key] === "string") {
    configLabelKey = (payload as Record<string, string>)[key]
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === "string") {
    configLabelKey = payloadPayload[key] as string
  }

  return configLabelKey in config ? config[configLabelKey] : config[key]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  chartColor,
}
