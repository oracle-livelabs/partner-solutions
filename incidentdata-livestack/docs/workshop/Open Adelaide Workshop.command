#!/bin/zsh
set -eu

workshop_root="${0:A:h}"
workshop_url="http://127.0.0.1:18708/workshops/sandbox/?lab=introduction"
manifest_url="http://127.0.0.1:18708/workshops/sandbox/manifest.json"

is_our_server() {
  /usr/bin/curl --silent --show-error --fail --max-time 2 "$manifest_url" 2>/dev/null | /usr/bin/grep -q 'Adelaide workshop'
}

started_here=0
if ! is_our_server; then
  if /usr/sbin/lsof -nP -iTCP:18708 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port 18708 is in use by another service. Close that service, then try again."
    exit 1
  fi
  /usr/bin/python3 -m http.server 18708 --bind 127.0.0.1 --directory "$workshop_root" > "$workshop_root/validation/local-server.log" 2>&1 &
  started_here=1
  echo $! > "$workshop_root/validation/local-server.pid"
  for attempt in {1..30}; do
    if is_our_server; then break; fi
    /bin/sleep 0.2
  done
fi

if ! is_our_server; then
  echo "The Adelaide workshop did not start. See validation/local-server.log."
  exit 1
fi

if [[ "${1:-}" != "--no-open" ]]; then
  /usr/bin/open "$workshop_url"
  echo "Opened the Adelaide workshop in your default browser."
else
  echo "Adelaide workshop ready: $workshop_url"
fi

if (( started_here )); then
  echo "Keep this Terminal window open while using the workshop."
  wait
fi
