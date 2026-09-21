#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

server := "http://127.0.0.1:3000/api/local-hotkey"
mods := Map("Control","Ctrl","Shift","Shift","Alt","Alt","LWin","Meta","RWin","Meta")

SendSignature(keyName) {
    global server
    if (mods.Has(keyName))
        return
    parts := []
    if GetKeyState("Ctrl","P")
        parts.Push("Ctrl")
    if GetKeyState("Alt","P")
        parts.Push("Alt")
    if GetKeyState("Shift","P")
        parts.Push("Shift")
    if GetKeyState("LWin","P") || GetKeyState("RWin","P")
        parts.Push("Meta")

    code := KeyToCode(keyName)
    if code = ""
        return
    sig := ""
    for p in parts
        sig .= (sig="" ? "" : "+") p
    sig .= (sig="" ? "" : "+") code

    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open("POST", server, false)
        req.SetRequestHeader("Content-Type","application/json")
        req.Send('{"signature":"' StrReplace(sig,'"','\"') '"}')
    }
}

KeyToCode(k) {
    if RegExMatch(k, "^F([1-9]|1[0-2])$")
        return k
    if StrLen(k)=1 {
        if k ~= "^[A-Za-z]$"
            return "Key" StrUpper(k)
        if k ~= "^[0-9]$"
            return "Digit" k
    }
    table := Map(
      "Space","Space","Enter","Enter","Tab","Tab","Escape","Escape",
      "Backspace","Backspace","Delete","Delete","Insert","Insert",
      "Home","Home","End","End","PgUp","PageUp","PgDn","PageDown",
      "Up","ArrowUp","Down","ArrowDown","Left","ArrowLeft","Right","ArrowRight",
      "Numpad0","Numpad0","Numpad1","Numpad1","Numpad2","Numpad2","Numpad3","Numpad3",
      "Numpad4","Numpad4","Numpad5","Numpad5","Numpad6","Numpad6","Numpad7","Numpad7",
      "Numpad8","Numpad8","Numpad9","Numpad9",
      "NumpadAdd","NumpadAdd","NumpadSub","NumpadSubtract","NumpadMult","NumpadMultiply","NumpadDiv","NumpadDivide"
    )
    return table.Has(k) ? table[k] : ""
}

keys := []
Loop 26
    keys.Push(Chr(64+A_Index))
Loop 10
    keys.Push(String(A_Index-1))
Loop 12
    keys.Push("F" A_Index)
for k in ["Space","Enter","Tab","Escape","Backspace","Delete","Insert","Home","End","PgUp","PgDn","Up","Down","Left","Right",
          "Numpad0","Numpad1","Numpad2","Numpad3","Numpad4","Numpad5","Numpad6","Numpad7","Numpad8","Numpad9","NumpadAdd","NumpadSub","NumpadMult","NumpadDiv"] {
    keys.Push(k)
}

for k in keys {
    keyCopy := k
    try Hotkey("~*" keyCopy, (*) => SendSignature(keyCopy))
}

A_TrayMenu.Add("Buzzer-Bridge beenden", (*) => ExitApp())
TrayTip("Musiklex Buzzer", "Globale Hotkeys sind aktiv.")
