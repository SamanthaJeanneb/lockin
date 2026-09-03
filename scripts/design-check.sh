#!/usr/bin/env bash
# The four checks from tokens.css, run in CI. They prevent the drift the token
# file exists to stop, and they are cheap enough to run on every commit.
set -uo pipefail

fail=0
report() { echo "  ✗ $1"; echo "$2" | head -20; fail=1; }

echo "Design system check"

# src/lib/brand.ts is the single documented exception: browser chrome metadata
# and email HTML are both rendered where CSS variables do not exist.
if out=$(grep -rEn '#[0-9a-fA-F]{3,8}\b' src --include='*.tsx' --include='*.ts' \
        | grep -v 'src/styles/' | grep -v 'src/lib/brand.ts' | grep -v '//' ); [ -n "$out" ]; then
  report "hex literal outside tokens.css" "$out"
else echo "  ✓ no hex outside tokens.css"; fi

if out=$(grep -rEn '\[[0-9]+px\]|\[#[0-9a-fA-F]' src/components src/app --include='*.tsx' \
        | grep -vE 'w-\[|max-w-\[|min-w-\[|h-\[|max-h-\[|min-h-\[|top-\[|left-\[|size-\[|inset-\[|bottom-\[|grid-cols-\[' ); [ -n "$out" ]; then
  report "arbitrary Tailwind value" "$out"
else echo "  ✓ no arbitrary colour or spacing values"; fi

if out=$(grep -rEn '\bdark:' src/components src/app --include='*.tsx'); [ -n "$out" ]; then
  report "dark: variant in a component — themes swap at the token layer" "$out"
else echo "  ✓ no dark: variants"; fi

if out=$(grep -rEn 'rounded-(xl|2xl|3xl)' src/components src/app --include='*.tsx'); [ -n "$out" ]; then
  report "radius above the 8px ceiling" "$out"
else echo "  ✓ no radius above 8px"; fi

if out=$(grep -rEn 'bg-gradient-|bg-linear-|bg-radial-|backdrop-blur|from-[a-z]+-[0-9]' src/components src/app --include='*.tsx'); [ -n "$out" ]; then
  report "gradient or backdrop blur" "$out"
else echo "  ✓ no gradients or glassmorphism"; fi

[ $fail -eq 0 ] && echo "Clean." || echo "Design check failed."
exit $fail
