const API_BASE = 'http://10.30.9.1';

export async function postConvert(payload: unknown) {
    const resp = await fetch(`${API_BASE}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${text}`);
    }
    return resp.json();
}
