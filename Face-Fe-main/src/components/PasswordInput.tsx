import { useState } from 'react';

export function PasswordInput({ disabled = false, autoComplete = 'new-password', minLength, maxLength }: {
  disabled?: boolean; autoComplete?: string; minLength?: number; maxLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return <label>Mật khẩu<div className="password-field">
    <input name="password" type={visible ? 'text' : 'password'} autoComplete={autoComplete} required disabled={disabled} minLength={minLength} maxLength={maxLength}/>
    <button type="button" aria-pressed={visible} disabled={disabled} onClick={() => setVisible(v => !v)}>{visible ? 'Ẩn' : 'Hiện'}</button>
  </div></label>;
}
