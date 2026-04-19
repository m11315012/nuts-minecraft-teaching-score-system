import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ModalCtx = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const close = useCallback((result) => {
    setModal((m) => {
      if (m) m.resolve(result);
      return null;
    });
  }, []);

  const open = useCallback((config) => {
    return new Promise((resolve) => {
      setModal({ ...config, resolve });
    });
  }, []);

  const api = {
    alert: (message, opts = {}) =>
      open({ type: 'alert', title: opts.title || '提示', message, okText: opts.okText || '好' }),
    confirm: (message, opts = {}) =>
      open({
        type: 'confirm',
        title: opts.title || '請確認',
        message,
        okText: opts.okText || '確定',
        cancelText: opts.cancelText || '取消',
        danger: !!opts.danger,
      }),
    prompt: (title, defaultValue = '', opts = {}) =>
      open({
        type: 'form',
        title,
        fields: [{ name: 'value', label: opts.label || '', defaultValue, type: opts.inputType || 'text', required: opts.required !== false }],
        submitText: opts.okText || '確定',
        cancelText: opts.cancelText || '取消',
        _singleField: true,
      }),
    form: (title, fields, opts = {}) =>
      open({
        type: 'form',
        title,
        fields,
        submitText: opts.submitText || '確定',
        cancelText: opts.cancelText || '取消',
      }),
  };

  return (
    <ModalCtx.Provider value={api}>
      {children}
      {modal && <ModalView modal={modal} close={close} />}
    </ModalCtx.Provider>
  );
}

function ModalView({ modal, close }) {
  const [values, setValues] = useState(() => {
    const init = {};
    (modal.fields || []).forEach((f) => { init[f.name] = f.defaultValue ?? ''; });
    return init;
  });
  const firstInputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close(modal.type === 'form' ? null : false);
    };
    window.addEventListener('keydown', onKey);
    if (firstInputRef.current) firstInputRef.current.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    if (modal._singleField) close(values.value);
    else close(values);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(modal.type === 'form' ? null : false); }}>
      <div className="modal panel" role="dialog" aria-modal="true">
        <h3 style={{ marginTop: 0 }}>{modal.title}</h3>

        {modal.type === 'alert' && (
          <>
            <p>{modal.message}</p>
            <div className="modal-actions">
              <button onClick={() => close(true)}>{modal.okText}</button>
            </div>
          </>
        )}

        {modal.type === 'confirm' && (
          <>
            <p style={{ whiteSpace: 'pre-wrap' }}>{modal.message}</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => close(false)}>{modal.cancelText}</button>
              <button className={modal.danger ? 'danger' : ''} onClick={() => close(true)}>{modal.okText}</button>
            </div>
          </>
        )}

        {modal.type === 'form' && (
          <form onSubmit={onSubmit}>
            <div style={{ display: 'grid', gap: 10 }}>
              {modal.fields.map((f, i) => (
                <div key={f.name}>
                  {f.label && <label style={{ display: 'block', marginBottom: 4 }}>{f.label}</label>}
                  {f.type === 'textarea' ? (
                    <textarea
                      ref={i === 0 ? firstInputRef : null}
                      rows={f.rows || 3}
                      value={values[f.name]}
                      required={f.required}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      style={{ width: '100%' }}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      ref={i === 0 ? firstInputRef : null}
                      value={values[f.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      style={{ width: '100%', padding: 8, background: '#1a1a1a', color: '#fff', border: '3px solid #555' }}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      ref={i === 0 ? firstInputRef : null}
                      type={f.type || 'text'}
                      value={values[f.name]}
                      required={f.required}
                      placeholder={f.placeholder || ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => close(null)}>{modal.cancelText}</button>
              <button type="submit">{modal.submitText}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export const useModal = () => useContext(ModalCtx);
