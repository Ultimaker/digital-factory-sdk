import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DigitalFactoryDemo } from "./digital-factory";
import { print } from "./print";
import * as fs from "fs";

// Define an interface based on the structure observed in temp.json
interface ExtruderConfig {
    extruder_index: number;
    material?: {
        brand?: string;
        color?: string;
        guid?: string;
        material?: string; // Assuming this is the type
    };
    print_core_id?: string;
    temperature?: number;
}

interface HostPrinterInfo {
    configuration?: ExtruderConfig[];
    friendly_name?: string;
    machine_variant?: string;
    status?: string;
    uuid: string;
}

interface ClusterInfo {
    cluster_id?: string;
    host_printer?: HostPrinterInfo;
    // Add other relevant fields from temp.json if needed
}

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

    // Expose printers as a flattened list resource
    server.resource(
        "printers",
        "ultimaker://printers", // Define a URI for the printers resource
        async (uri) => {
            // Cast the result to the defined interface
            const clusters = await demo.getClusters() as ClusterInfo[];

            // Flatten the cluster data into the desired printer list format
            const printers = clusters.map(cluster => {
                // Handle cases where host_printer might be missing
                if (!cluster.host_printer) {
                    return null; // Skip clusters without host_printer info
                }
                const printer = cluster.host_printer;

                // Map extruder configuration
                const extruders = printer.configuration?.map(extruder => ({
                    brand: extruder.material?.brand ?? 'N/A',
                    type: extruder.material?.material ?? 'N/A', // Use 'material' field as type
                    color: extruder.material?.color ?? 'N/A',
                    print_core_id: extruder.print_core_id ?? 'N/A'
                })) ?? []; // Default to empty array if configuration is missing

                return {
                    cluster_id: cluster.cluster_id ?? 'N/A',
                    friendly_name: printer.friendly_name ?? 'N/A',
                    machine_variant: printer.machine_variant ?? 'N/A',
                    status: printer.status ?? 'N/A',
                    extruders: extruders
                };
            }).filter(printer => printer !== null); // Remove any null entries from skipped clusters

            return {
                contents: [{
                    uri: uri.href, // Use the requested URI
                    text: JSON.stringify(printers, null, 2)
                }]
            };
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    // Log the error to file instead of console
    log(`Error in MCP server: ${err.message}`);
    log(`Stack trace: ${err.stack}`);
    process.exit(1);
});
