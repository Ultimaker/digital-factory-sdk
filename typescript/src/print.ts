export const print = console.log.bind(console); // eslint-disable-line no-console

export function prettyJSON(jsonObject: any): string {
    return JSON.stringify(jsonObject, null, 4);
}
