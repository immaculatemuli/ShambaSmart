// The app sends X-Language: sw for Kiswahili. Texts the server makes (alerts, calendar tasks, photo checks) follow it.
export const languageOf = (req) => (req.get('x-language') === 'sw' ? 'sw' : 'en');

/** Picks the Kiswahili or English text of a { en, sw } pair. */
export const pick = (text, lang) => (typeof text === 'string' ? text : (text[lang] ?? text.en));
