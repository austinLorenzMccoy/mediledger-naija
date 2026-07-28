# shellcheck shell=bash
# Safe .env loader (handles spaces in values). Source from other scripts:
#   source "$(dirname "$0")/load-env.sh"
_ENV_FILE="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/.env"
if [ -f "$_ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # skip comments / blanks
    case "$line" in
      ''|\#*) continue ;;
    esac
    # only KEY=VALUE
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      # strip surrounding quotes
      if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:${#val}-2}"; fi
      if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:${#val}-2}"; fi
      export "$key=$val"
    fi
  done < "$_ENV_FILE"
fi
unset _ENV_FILE
