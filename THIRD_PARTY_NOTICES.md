# Third-party material

## EFF's Long Wordlist

Copyright Electronic Frontier Foundation. Distributed under the
[Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/),
under [EFF's copyright policy](https://www.eff.org/copyright).

- Source: https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt
- Method and context: https://www.eff.org/dice
- Retrieved: 2026-10-31.
- Original SHA-256: `addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e`.
- The original file is retained at `data/eff-large-wordlist.txt`.
- `src/data/eff-words.json` (and its packaged copy under `dist/data/`) removes
  the dice-code column and serializes the words as JSON. Word spelling, order,
  case and hyphens are unchanged. There are 7776 unique ASCII entries, 3–9
  characters long; four contain a hyphen. No words were added or removed.

Attribution does not imply EFF endorsement. The project's MIT license applies to
its code; it does not relicense this dictionary. Both licenses are represented in
the package's SPDX expression.
