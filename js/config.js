// Koneksi Supabase (publishable key aman untuk frontend; JANGAN pakai service_role/secret key di sini).
window.LS={url:'https://sieclcbuyaayolyosnhe.supabase.co',key:'sb_publishable_L2aRJJm8jqCUgHn1P8pN9w_i2ZyIhU3',bucket:'site-media'};
window.sb=window.supabase.createClient(window.LS.url,window.LS.key);
