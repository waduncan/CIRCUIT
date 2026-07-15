import { useEffect, useState } from "react";
import type { Selection } from "../model/types";

export function useEditorInteraction() {
  const [selection, setSelection] = useState<Selection>({ type: "node", id: "app-1" });
  const [connectionMode, setConnectionMode] = useState(false);
  const [connecting, setConnecting] = useState<{ nodeId: string; portId: string } | null>(null);
  const [modifierKeys, setModifierKeys] = useState({ ctrl: false, shift: false });
  const [panning, setPanning] = useState<boolean>(false);


  useEffect(() => {
    const updateModifiers = (event: KeyboardEvent) => setModifierKeys({ ctrl: event.ctrlKey, shift: event.shiftKey });
    const clearModifiers = () => setModifierKeys({ ctrl: false, shift: false });
    window.addEventListener("keydown", updateModifiers);
    window.addEventListener("keyup", updateModifiers);
    window.addEventListener("blur", clearModifiers);
    return () => {
      window.removeEventListener("keydown", updateModifiers);
      window.removeEventListener("keyup", updateModifiers);
      window.removeEventListener("blur", clearModifiers);
    };
  }, []);

  return { selection, setSelection, connectionMode, setConnectionMode, connecting, setConnecting, modifierKeys, panning, setPanning };
}
