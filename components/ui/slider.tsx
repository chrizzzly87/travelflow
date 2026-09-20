import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbIdsRef = React.useRef<string[]>([])
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )
  while (thumbIdsRef.current.length < _values.length) {
    thumbIdsRef.current.push(`thumb-${thumbIdsRef.current.length + 1}`)
  }

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-slate-200 data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {_values.map((thumbValue, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={thumbIdsRef.current[index]}
          aria-label={ariaLabel ? `${ariaLabel}${_values.length > 1 ? ` ${index + 1}` : ""}` : undefined}
          aria-labelledby={ariaLabelledBy}
          // A 16px white disc with a 1px border was effectively invisible on a
          // white panel — worst at the minimum, where it sits flush against the
          // track's start, and worse again when the slider is disabled and the
          // whole group drops to 50% opacity. Bigger, with a solid ring and a
          // real shadow, so it reads as a grabbable knob on any surface.
          className="block size-5 shrink-0 rounded-full border-2 border-primary bg-card shadow-md ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:shadow-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
