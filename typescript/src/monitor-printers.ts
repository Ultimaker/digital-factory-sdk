import { createWriteStream, existsSync } from 'fs';
import {
    mkdir, readdir, readFile, writeFile,
} from 'fs/promises';
import { DigitalFactoryDemo } from './digital-factory';
import { prettyJSON, print } from './print';

/**
 * Contains the used fields from the Connect API cluster response.
 */
interface ClusterResponse {
    cluster_id: string;
    is_online: boolean;
}

/**
 * Describes the comparison between two lists of clusters.
 */
interface Comparison {
    dateTime: string;
    appeared: string[];
    gone: string[];
    onlineCount: number;
    offlineCount: number;
}

/**
 * The options that may be given to this script.
 */
interface MonitorClustersOptions {
    comparisonFile?: string;
    statusDir?: string;
    waitMS?: number;
}

/**
 * Gets the previous cluster status from the status log directory. Ensures that the directory actually exists.
 */
async function getPreviousClusterStatus(statusDir: string): Promise<ClusterResponse[] | null> {
    if (!existsSync(statusDir)) {
        await mkdir(statusDir, { recursive: true });
        return null;
    }
    const existingFiles = await readdir(statusDir);
    const lastFile = existingFiles.filter((file) => file.endsWith('.json')).sort((a, b) => b.localeCompare(a))[0];
    return lastFile && JSON.parse(await readFile(`${statusDir}/${lastFile}`, 'utf-8'));
}

/**
 * Compares two lists of cluster statuses.
 */
function compareResults(previous: ClusterResponse[], current: ClusterResponse[], dateTime: Date): Comparison {
    const getOnlineClusterIds = (clusters: ClusterResponse[]): Set<string> => new Set<string>(
        clusters.filter((cluster) => cluster.is_online).map((cluster) => cluster.cluster_id),
    );
    const previousOnlineIds = getOnlineClusterIds(previous);
    const currentOnlineIds = getOnlineClusterIds(current);
    return {
        dateTime: dateTime.toISOString(),
        appeared: [...currentOnlineIds].filter((id) => !previousOnlineIds.has(id)),
        gone: [...previousOnlineIds].filter((id) => !currentOnlineIds.has(id)),
        onlineCount: currentOnlineIds.size,
        offlineCount: current.length - currentOnlineIds.size,
    };
}

/**
 * Creates a CSV line from the given comparison.
 */
function csvLine(comparison: Comparison, separator = ';'): string {
    const fields: (keyof Comparison)[] = ['dateTime', 'appeared', 'gone', 'onlineCount', 'offlineCount'];
    return fields.map((field) => comparison[field]).join(separator);
}

/**
 * Gets all clusters from the API periodically, writing the response to a JSON file & the comparisons to a CSV file.
 */
async function monitorClusters({
    comparisonFile = '../cluster-monitoring-logs/cluster-monitoring.csv',
    waitMS = 60000,
    statusDir = '../cluster-monitoring-logs',
}: MonitorClustersOptions = {}): Promise<void> {
    let stop = false;
    process.on('SIGINT', () => {
        stop = true;
    });

    const demo = new DigitalFactoryDemo();
    await demo.signIn();
    print('Sign in completed.\n');

    let previous = await getPreviousClusterStatus(statusDir);
    const stream = createWriteStream(comparisonFile, { flags: 'a' });

    try {
        /* eslint-disable no-await-in-loop */
        while (!stop) {
            print('Retrieving clusters...');
            const clusters = await demo.getClusters();
            const dateTime = new Date();
            const logFile = `${statusDir}/${dateTime.toISOString().replace(/:/g, '-')}-clusters.json`;
            await writeFile(logFile, prettyJSON(clusters));
            print(`Found ${clusters.length} clusters\n`);
            if (previous) {
                const comparison = compareResults(previous, clusters, dateTime);
                stream.write(`${csvLine(comparison)}\n`);
                print(`Comparison resulted in ${prettyJSON(comparison)}\n`);
            }
            previous = clusters;
            await new Promise((resolve) => setTimeout(resolve, waitMS));
        }
    } catch (e: unknown) {
        console.error(e); // eslint-disable-line no-console
        process.exit(1);
    } finally {
        stream.end();
    }
}

monitorClusters().then(() => process.exit(0));
