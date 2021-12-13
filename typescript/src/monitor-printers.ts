import { createWriteStream, existsSync } from 'fs';
import {
    mkdir, readdir, readFile, writeFile,
} from 'fs/promises';
import { DigitalFactoryDemo } from './digital-factory';
import { prettyJSON, print } from './print';

interface ClusterResponse {
    capabilities?: string[];
    cluster_id: string;
    display_status?: 'error' | 'idle' | 'maintenance' | 'pre_print' | 'printing' | 'unknown' | 'unreachable' | 'offline' | 'disabled' | 'updating_firmware';
    friendly_name: string;
    host_current_print_job?: any;
    host_guid: string;
    host_internal_ip?: string;
    host_name: string;
    host_print_job_count?: number;
    host_printer?: any;
    host_remaining_print_time?: number;
    host_version?: string;
    is_online: boolean;
    organization_id?: string;
    organization_shared?: boolean;
    printer_count: number;
    printer_type?: 'ultimaker2_plus_connect' | 'ultimaker3' | 'ultimaker3_extended' | 'ultimaker_s3' | 'ultimaker_s5';
    status: 'active' | 'inactive';
    team_ids?: string[];
    user_id?: string;
}

interface Comparison {
    dateTime: string;
    appeared: string[];
    gone: string[];
    onlineCount: number;
    offlineCount: number;
}

function compareResults(previous: ClusterResponse[], current: ClusterResponse[], dateTime: Date): Comparison {
    const getOnlineClusterIds = <T, K extends keyof any>(clusters: ClusterResponse[]): Set<string> => new Set<string>(
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

function csvLine(comparison: Comparison): string {
    const fields: (keyof Comparison)[] = ['dateTime', 'appeared', 'gone', 'onlineCount', 'offlineCount'];
    return fields.map((field) => comparison[field]).join(';');
}

interface MonitorClustersOptions {
    comparisonFile?: string;
    statusDir?: string;
    waitMS?: number;
}

async function getPreviousClusterStatus(statusDir: string): Promise<ClusterResponse[] | null> {
    if (!existsSync(statusDir)) {
        await mkdir(statusDir, { recursive: true });
        return null;
    }
    const existingFiles = await readdir(statusDir);
    const lastFile = existingFiles.filter((file) => file.endsWith('.json')).sort((a, b) => b.localeCompare(a))[0];
    return lastFile && JSON.parse(await readFile(`${statusDir}/${lastFile}`, 'utf-8'));
}

/* eslint-disable no-await-in-loop */
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

    while (!stop) {
        print('Creating demo project...');
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

    stream.end();
}

monitorClusters()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
        console.error(error); // eslint-disable-line no-console
        process.exit(1);
    });
