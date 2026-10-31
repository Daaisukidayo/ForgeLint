/**
 * @param codes ANSI SGR codes.
 * @returns A colorizer, which does nothing when `NO_COLOR` is set.
 */
const paint = (codes: string) => (text: string) => (process.env.NO_COLOR ? text : `\u001b[${codes}m${text}\u001b[0m`)

export const green = paint("32")
export const red = paint("31")
export const yellow = paint("33")
export const cyan = paint("36")
export const grey = paint("90")
export const bold = paint("1")
