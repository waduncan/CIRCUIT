import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { ComponentProps } from "react";

export function Switch({ className = "", ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={`ui-switch ${className}`} {...props}><SwitchPrimitive.Thumb className="ui-switch-thumb" /></SwitchPrimitive.Root>;
}
