export const API_CONFIG = {
    XML_UPLOAD_URL: '/api/upload/',
    // WARNING: In a purely client-side app, this key is visible to the user.
    // Ensure the backend Vercel Function validates the origin or uses Supabase Auth tokens if possible.
    // For now, this matches the default 'secret' in api/index.py.
    API_KEY_HEADER: 'Authorization',
    API_KEY_VALUE: 'secret'
};
