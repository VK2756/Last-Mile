# Source this file: loads KEY=VALUE lines from the given env files literally (no shell parsing,
# so values containing & ; $ spaces etc. work). Never prints values.
lm_load_env() {
  local f line k v
  for f in "$@"; do
    [ -f "$f" ] || continue
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%$'\r'}"
      case "$line" in ''|'#'*) continue ;; esac
      line="${line#export }"
      case "$line" in *=*) ;; *) continue ;; esac
      k="${line%%=*}"; v="${line#*=}"
      case "$k" in *[!A-Za-z0-9_]*|'') continue ;; esac
      case "$v" in \"*\") v="${v#\"}"; v="${v%\"}" ;; \'*\') v="${v#\'}"; v="${v%\'}" ;; esac
      export "$k=$v"
    done < "$f"
  done
}
