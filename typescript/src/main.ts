import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DigitalFactoryDemo } from "./digital-factory";
import { print } from "./print";
import * as fs from "fs";

// Redirect console output to avoid interfering with the stdio transport
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Redirect console outputs to prevent interference with JSON communication
console.log = (...args) => {};
console.error = (...args) => {};
console.warn = (...args) => {};
console.info = (...args) => {};

// Custom logger function to use instead of console
function log(...args: any[]) {
    // Log to a file instead of stdout/stderr
    fs.appendFileSync('mcp-server.log', args.join(' ') + '\n');
}

async function main() {
    const demo = new DigitalFactoryDemo();
    await demo.signIn();
    log("Signed in to Ultimaker Digital Factory.");

    const server = new McpServer({
        name: "Ultimaker Digital Factory MCP",
        version: "1.0.0"
    });

    // Expose clusters as a resource
    server.resource(
        "clusters",
        "ultimaker://clusters",
        async (uri) => {
            const clusters = await demo.getClusters();
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(clusters, null, 2)
                }]
            };
        }
    );

    // Expose projects as a resource
    server.resource(
        "projects",
        "ultimaker://projects",
        async (uri) => {
            const projects = await demo.searchProjects();
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(projects, null, 2)
                }]
            };
        }
    );

    // Add more resources/tools as needed...

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    // Log the error to file instead of console
    log(`Error in MCP server: ${err.message}`);
    log(`Stack trace: ${err.stack}`);
    process.exit(1);
});
