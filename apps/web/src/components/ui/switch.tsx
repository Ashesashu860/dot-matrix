"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Box Hunt switch: 58×34 track, green when on, springy knob.
        "peer group/switch relative inline-flex h-[34px] w-[58px] shrink-0 cursor-pointer items-center rounded-full border-none p-1 transition-colors duration-200 outline-none after:absolute after:-inset-x-2 after:-inset-y-2 data-checked:bg-green data-unchecked:bg-[#DCD3E8] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[26px] rounded-full bg-white shadow-[0_2px_4px_rgba(43,27,74,.25)] transition-transform duration-[250ms] ease-[cubic-bezier(.3,1.6,.5,1)] data-checked:translate-x-6 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
