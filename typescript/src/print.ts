import * as fs from 'fs';

// Redirect console output to file instead of stdout to avoid interfering with stdio transport
export const print = (...args: any[]): void => {
    fs.appendFileSync('mcp-server.log', args.join(' ') + '\n');
};

export function prettyJSON(jsonObject: any): string {
    return JSON.stringify(jsonObject, null, 4);
}
