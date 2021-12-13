import { createHash, randomBytes } from 'crypto';
import {
    createServer, IncomingMessage, Server, ServerResponse,
} from 'http';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { print, prettyJSON } from './print';

const DEFAULT_CLOUD_ACCOUNT_API_ROOT = 'https://account.ultimaker.com';
const OAUTH_SERVER_URL = DEFAULT_CLOUD_ACCOUNT_API_ROOT;
const API_ROOT_URL = 'https://api.ultimaker.com';

const CALLBACK_SERVER_PORT = 32118;

const { CLIENT_ID } = process.env;
const { SCOPES } = process.env;

export interface TokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
}

export class DigitalFactoryDemo {
    private _callbackServer: Server = null;

    private _state: string = null;

    private _pkceVerifier: string = null;

    private _tokenPair: TokenResponse = null;

    private _token_url: string = null;

    private _authorizationUrl = `${OAUTH_SERVER_URL}/authorize`;

    private _redirectUri: string = null;

    private _signInCompleteResolve: () => void = null;

    signIn(): Promise<void> {
        this._callbackServer = createServer(this._handleRequest.bind(this));
        this._callbackServer.listen(CALLBACK_SERVER_PORT);

        this._token_url = `${OAUTH_SERVER_URL}/token`;
        this._redirectUri = `http://localhost:${CALLBACK_SERVER_PORT}/callback`;

        this._state = this._generateState();
        this._pkceVerifier = this._generatePKCEVerifier();
        const query = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: this._redirectUri,
            scope: SCOPES,
            state: this._state,
            response_type: 'code',
            code_challenge: this._generatePKCEChallenge(this._pkceVerifier),
            code_challenge_method: 'S512',
        });
        const signInUrl = `${this._authorizationUrl}?${query}`;

        print('Open the following URL in your browser and log in to Ultimaker Digital Factory:');
        print('');
        print(`    ${signInUrl}`);
        print('');
        return new Promise<void>((resolve, reject) => {
            this._signInCompleteResolve = resolve;
        });
    }

    private async _handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!req.url) {
            return;
        }
        if (!this._pkceVerifier) {
            return;
        }

        const url = new URL(`http://localhost:${CALLBACK_SERVER_PORT}${req.url}`);

        const code = url.searchParams.get('code');
        if (!code) {
            return;
        }

        const state = url.searchParams.get('state');
        if (!state || state !== this._state) {
            return;
        }

        this._tokenPair = await this._requestAccessToken(code, this._pkceVerifier);

        print(`Access token: ${prettyJSON(this._tokenPair.access_token)}`);

        res.writeHead(200);
        res.end('Sign in finished, you can now close this window.');

        // reset everything
        this._callbackServer && this._callbackServer.close(); // eslint-disable-line no-unused-expressions
        this._callbackServer = null;
        this._state = null;
        this._pkceVerifier = null;

        this._signInCompleteResolve();
    }

    private async _requestAccessToken(code: string, pkceVerifier: string): Promise<TokenResponse> {
        const tokenResponse = await fetch(this._token_url, {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                redirect_uri: this._redirectUri,
                grant_type: 'authorization_code',
                scope: SCOPES,
                code,
                code_verifier: pkceVerifier,
            }),
        });

        return tokenResponse.json();
    }

    private _generateState(): string {
        return randomBytes(16).toString('base64');
    }

    private _generatePKCEVerifier(): string {
        return randomBytes(32).toString('base64');
    }

    private _generatePKCEChallenge(verifier: string): string {
        return createHash('sha512').update(verifier).digest().toString('base64');
    }

    private _getRequestHeaders(): {[key: string]: string} {
        return {
            Authorization: `Bearer ${this._tokenPair.access_token}`,
        };
    }

    async httpGetDigitalFactory(url: string): Promise<any> {
        const response = await fetch(url, {
            method: 'GET',
            headers: this._getRequestHeaders(),
        });
        return response.json();
    }

    async httpPutDigitalFactory(url: string, body: any, additional_headers: any = {}): Promise<any> {
        const headers = {
            'Content-Type': 'application/json',
            ...additional_headers,
            ...this._getRequestHeaders(),
        };
        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: prettyJSON(body),
        });
        return response.json();
    }

    async httpPostDigitalFactory(url: string, body: any = {}, additional_headers: any = {}): Promise<any> {
        const headers = {
            'Content-Type': 'application/json',
            ...additional_headers,
            ...this._getRequestHeaders(),
        };
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: prettyJSON(body),
        });
        return response.json();
    }

    async createProject(name: string): Promise<any> {
        const response = await this.httpPutDigitalFactory(
            `${API_ROOT_URL}/cura/v1/projects`,
            {
                data: {
                    display_name: name,
                },
            },
        );
        return response.data;
    }

    async uploadFileToProject(libraryProjectId: string, filePath: string): Promise<any> {
        const filename = path.posix.basename(filePath);
        const fileContents = fs.readFileSync(filePath);
        const contentLength = fileContents.byteLength;
        const mimeType = 'application/x-ufp';

        const jobUploadResponse = await this.httpPutDigitalFactory(`${API_ROOT_URL}/cura/v1/jobs/upload`, {
            data: {
                job_name: filename,
                content_type: mimeType,
                file_size: contentLength,
                library_project_id: libraryProjectId,
            },
        });
        const uploadUrl = jobUploadResponse.data.upload_url;
        print(`upload url: ${uploadUrl}`);

        await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: fileContents,
        });
        return jobUploadResponse.data;
    }

    async addCommentToProject(projectId: string, comment: string): Promise<void> {
        const response = await this.httpPutDigitalFactory(
            `${API_ROOT_URL}/cura/v1/projects/${projectId}/comments`,
            {
                data: {
                    body: comment,
                },
            },
        );
        return response.data;
    }

    async submitPrintJob(jobId: string, clusterId: string): Promise<any> {
        const response = await this.httpPostDigitalFactory(
            `${API_ROOT_URL}/connect/v1/clusters/${clusterId}/print/${jobId}`,
            { data: {} },
        );
        return response.data;
    }

    async getRunningPrintJobs(): Promise<any> {
        const query = new URLSearchParams({
            limit: '20',
            status: 'in_progress',
        });
        const response = await this.httpGetDigitalFactory(`${API_ROOT_URL}/connect/v1/print_jobs?${query}`);
        return response.data;
    }

    async searchProjects(): Promise<any> {
        const query = new URLSearchParams({
            limit: '24',
            page: '1',
            search: 'demo',
            shared: 'false',
        });
        const response = await this.httpGetDigitalFactory(`${API_ROOT_URL}/cura/v1/projects?${query}`);
        return response.data;
    }
}
