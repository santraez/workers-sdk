import * as fs from "node:fs";
import { Request } from "undici";
import { unstable_dev } from "../api";
import { printWranglerBanner } from "../update-check";
import { runInTempDir } from "./helpers/run-in-tmp";

jest.unmock("child_process");
jest.unmock("undici");

describe("unstable_dev", () => {
	it("should return Hello World", async () => {
		const worker = await unstable_dev(
			"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
			{
				ip: "127.0.0.1",
				experimental: {
					disableExperimentalWarning: true,
					disableDevRegistry: true,
				},
			}
		);
		const resp = await worker.fetch();
		if (resp) {
			const text = await resp.text();
			expect(text).toMatchInlineSnapshot(`"Hello World!"`);
		}
		await worker.stop();
	});

	it("should return the port that the server started on (1)", async () => {
		const worker = await unstable_dev(
			"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
			{
				ip: "127.0.0.1",
				experimental: {
					disableExperimentalWarning: true,
					disableDevRegistry: true,
				},
			}
		);
		expect(worker.port).toBeGreaterThan(0);
		await worker.stop();
	});

	it("should return the port that the server started on (2)", async () => {
		const worker = await unstable_dev(
			"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
			{
				ip: "127.0.0.1",
				experimental: {
					disableExperimentalWarning: true,
					disableDevRegistry: true,
				},
			}
		);
		expect(worker.port).not.toBe(0);
		await worker.stop();
	});

	describe("unstable_dev network calls", () => {
		it("should not make a request to NPM without `updateCheck` being true", async () => {
			const worker = await unstable_dev(
				"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
				{
					ip: "127.0.0.1",
					experimental: {
						disableExperimentalWarning: true,
						disableDevRegistry: true,
					},
				}
			);
			const resp = await worker.fetch();
			expect(resp.status).toBe(200);

			expect((printWranglerBanner as jest.Mock).mock.calls[0][0]).toBe(false);

			await worker.stop();
		});

		it("should make a request to NPM when `updateCheck` is true", async () => {
			const worker = await unstable_dev(
				"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
				{
					ip: "127.0.0.1",
					experimental: {
						disableExperimentalWarning: true,
						disableDevRegistry: true,
					},
					updateCheck: true,
				}
			);
			const resp = await worker.fetch();
			expect(resp.status).toBe(200);

			expect((printWranglerBanner as jest.Mock).mock.calls[0][0]).toBe(true);

			await worker.stop();
		});
	});
});

describe("unstable dev fetch input protocol", () => {
	it("should use http localProtocol", async () => {
		const worker = await unstable_dev(
			"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
			{
				localProtocol: "http",
				ip: "127.0.0.1",
				experimental: {
					disableExperimentalWarning: true,
					disableDevRegistry: true,
				},
			}
		);
		const res = await worker.fetch();
		if (res) {
			const text = await res.text();
			expect(text).toMatchInlineSnapshot(`"Hello World!"`);
		}
		await worker.stop();
	});

	it("should use undefined localProtocol", async () => {
		const worker = await unstable_dev(
			"src/__tests__/helpers/worker-scripts/hello-world-worker.js",
			{
				localProtocol: undefined,
				ip: "127.0.0.1",
				experimental: {
					disableExperimentalWarning: true,
					disableDevRegistry: true,
				},
			}
		);
		const res = await worker.fetch();
		if (res) {
			const text = await res.text();
			expect(text).toMatchInlineSnapshot(`"Hello World!"`);
		}
		await worker.stop();
	});
});

describe("unstable dev fetch input parsing", () => {
	runInTempDir();

	it("should pass in a request object unchanged", async () => {
		const scriptContent = `
	export default {
		fetch(request, env, ctx) {
			const url = new URL(request.url);
			if (url.pathname === "/test") {
				if (request.method === "POST") {
					return new Response("requestPOST");
				}
				return new Response("requestGET");
			}
			return new Response('Hello world');
		}
	};
	`;
		fs.writeFileSync("index.js", scriptContent);
		const worker = await unstable_dev("index.js", {
			ip: "127.0.0.1",
			experimental: {
				disableExperimentalWarning: true,
				disableDevRegistry: true,
			},
		});
		const req = new Request(`http://127.0.0.1:${worker.port}/test`, {
			method: "POST",
		});
		const resp = await worker.fetch(req);
		let text;
		if (resp) {
			text = await resp.text();
		}
		expect(text).toMatchInlineSnapshot(`"requestPOST"`);
		await worker.stop();
	});

	it("should strip back to pathname for URL objects", async () => {
		const scriptContent = `
	export default {
		fetch(request, env, ctx) {
			const url = new URL(request.url);
			if (url.pathname === "/test") {
				return new Response("request");
			}
			return new Response('Hello world');
		}
	};
	`;
		fs.writeFileSync("index.js", scriptContent);
		const worker = await unstable_dev("index.js", {
			ip: "127.0.0.1",
			experimental: {
				disableExperimentalWarning: true,
				disableDevRegistry: true,
			},
		});
		const url = new URL("http://localhost:80/test");
		const resp = await worker.fetch(url);
		let text;
		if (resp) {
			text = await resp.text();
		}
		expect(text).toMatchInlineSnapshot(`"request"`);
		await worker.stop();
	});

	it("should allow full url passed in string, and stripped back to pathname", async () => {
		const scriptContent = `
	export default {
		fetch(request, env, ctx) {
			const url = new URL(request.url);
			if (url.pathname === "/test") {
				return new Response("request");
			}
			return new Response('Hello world');
		}
	};
	`;
		fs.writeFileSync("index.js", scriptContent);
		const worker = await unstable_dev("index.js", {
			ip: "127.0.0.1",
			experimental: {
				disableExperimentalWarning: true,
				disableDevRegistry: true,
			},
		});
		const resp = await worker.fetch("http://example.com/test");
		let text;
		if (resp) {
			text = await resp.text();
		}
		expect(text).toMatchInlineSnapshot(`"request"`);
		await worker.stop();
	});

	it("should allow pathname to be passed in", async () => {
		const scriptContent = `
	export default {
		fetch(request, env, ctx) {
			const url = new URL(request.url);
			if (url.pathname === "/test") {
				return new Response("request");
			}
			return new Response('Hello world');
		}
	};
	`;
		fs.writeFileSync("index.js", scriptContent);
		const worker = await unstable_dev("index.js", {
			ip: "127.0.0.1",
			experimental: {
				disableExperimentalWarning: true,
				disableDevRegistry: true,
			},
		});
		const resp = await worker.fetch("/test");
		let text;
		if (resp) {
			text = await resp.text();
		}
		expect(text).toMatchInlineSnapshot(`"request"`);
		await worker.stop();
	});

	it("should allow no input be passed in", async () => {
		const scriptContent = `
	export default {
		fetch(request, env, ctx) {
			const url = new URL(request.url);
			if (url.pathname === "/test") {
				return new Response("request");
			}
			return new Response('Hello world');
		}
	};
	`;
		fs.writeFileSync("index.js", scriptContent);
		const worker = await unstable_dev("index.js", {
			ip: "127.0.0.1",
			experimental: {
				disableExperimentalWarning: true,
				disableDevRegistry: true,
			},
		});
		const resp = await worker.fetch("");
		let text;
		if (resp) {
			text = await resp.text();
		}
		expect(text).toMatchInlineSnapshot(`"Hello world"`);
		await worker.stop();
	});
});
