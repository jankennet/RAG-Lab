// Shared styled text input + the raw class string it's built from.
//
// The class
//   w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text
//   outline-none focus:border-accent/40 transition-colors
// was copy-pasted ~20× across datasets, settings, benchmarks, benchmark-datasets.
// Two exports:
//   - <TextField {...inputProps} />     the common full-width text input.
//   - INPUT_CLASS                       the raw string, for the variants that need
//                                      different widths / paddings / focus-danger —
//                                      append className instead of duplicating.

import { forwardRef, type InputHTMLAttributes } from "react";

export const INPUT_CLASS =
  "bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors";

export const INPUT_FULL_CLASS = `w-full px-3 py-2.5 ${INPUT_CLASS}`;

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Replace the default full-width styling entirely (opts out of INPUT_FULL_CLASS). */
  bare?: boolean;
};

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { className, bare, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={bare ? className : `${INPUT_FULL_CLASS} ${className ?? ""}`}
      {...props}
    />
  );
});

export default TextField;
