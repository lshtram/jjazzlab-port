#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$ROOT_DIR/web/fixtures/styles/yamaha"
CACHE_DIR="$DEST_DIR/.downloads"
BASE_URL="https://www.jjazzlab.org/en/resources/pkg"

declare -A PACK_URLS=(
  [jazz]="$BASE_URL/JJazzLab-Jazz-1460.zip"
  [pop]="$BASE_URL/JJazzLab-Pop-400.zip"
  [brazilian]="$BASE_URL/JJazzLab-Brazilian-220.zip"
  [latin]="$BASE_URL/JJazzLab-Latin-50.zip"
  [stevie_wonder]="$BASE_URL/JJazzLab-StevieWonder-30.zip"
  [beatles]="$BASE_URL/JJazzLab-Beatles-71.zip"
  [pink_floyd]="$BASE_URL/JJazzLab-PinkFloyd-60.zip"
  [user_styles]="$BASE_URL/jjazzlab_user_styles.zip"
)

usage() {
  cat <<'USAGE'
Usage: fetch-yamaha-styles.sh [--all] [--pack <name>] [--force] [--list]

Options:
  --all         Download all packs.
  --pack NAME   Download a single pack (repeatable).
  --force       Re-download zip even if cached.
  --list        List available pack names.
  -h, --help    Show this help.
USAGE
}

list_packs() {
  printf 'Available packs:\n'
  for name in "${!PACK_URLS[@]}"; do
    printf '  %s\n' "$name"
  done | sort
}

download_file() {
  local url="$1"
  local dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL "$url" -o "$dest"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -O "$dest" "$url"
    return
  fi
  echo "Error: curl or wget is required." >&2
  exit 1
}

force=0
declare -a selected=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      selected=("__all__")
      shift
      ;;
    --pack)
      shift
      if [[ $# -eq 0 ]]; then
        echo "Error: --pack requires a name." >&2
        exit 1
      fi
      selected+=("$1")
      shift
      ;;
    --force)
      force=1
      shift
      ;;
    --list)
      list_packs
      exit 0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ${#selected[@]} -eq 0 ]]; then
  usage
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "Error: unzip is required." >&2
  exit 1
fi

mkdir -p "$DEST_DIR" "$CACHE_DIR"

declare -a packs_to_fetch=()
if [[ ${selected[0]} == "__all__" ]]; then
  for name in "${!PACK_URLS[@]}"; do
    packs_to_fetch+=("$name")
  done
else
  packs_to_fetch=("${selected[@]}")
fi

for pack in "${packs_to_fetch[@]}"; do
  url="${PACK_URLS[$pack]:-}"
  if [[ -z "$url" ]]; then
    echo "Error: unknown pack $pack" >&2
    list_packs
    exit 1
  fi

  zip_name="$(basename "$url")"
  zip_path="$CACHE_DIR/$zip_name"
  pack_dir="$DEST_DIR/$pack"

  if [[ $force -eq 1 || ! -f "$zip_path" ]]; then
    echo "Downloading $pack from $url"
    download_file "$url" "$zip_path"
  else
    echo "Using cached $zip_path"
  fi

  mkdir -p "$pack_dir"
  unzip -qo "$zip_path" -d "$pack_dir"
done
