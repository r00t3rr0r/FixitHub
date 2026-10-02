// E2E-Shim: react-quill ist lokal nicht installiert. Einfaches Textfeld als Ersatz.
import React from 'react';
export default function ReactQuill({ value, onChange, placeholder, className }) {
  return React.createElement('textarea', { value: value || '', placeholder, className, onChange: (e) => onChange && onChange(e.target.value) });
}
