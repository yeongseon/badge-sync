import { describe, expect, it } from "vitest";
import { createProgram } from "../src/cli.js";

function getCommand(name: string) {
	const command = createProgram().commands.find((c) => c.name() === name);
	if (!command) {
		throw new Error(`Missing command: ${name}`);
	}
	return command;
}

describe("cli", () => {
	it("creates a program with correct name", () => {
		const program = createProgram();
		expect(program.name()).toBe("badge-sync");
	});

	it("has apply command", () => {
		const program = createProgram();
		const apply = program.commands.find((c) => c.name() === "apply");
		expect(apply).toBeDefined();
	});

	it("has check command", () => {
		const program = createProgram();
		const check = program.commands.find((c) => c.name() === "check");
		expect(check).toBeDefined();
	});

	it("has doctor command", () => {
		const program = createProgram();
		const doctor = program.commands.find((c) => c.name() === "doctor");
		expect(doctor).toBeDefined();
	});

	it("has repair command", () => {
		const program = createProgram();
		const repair = program.commands.find((c) => c.name() === "repair");
		expect(repair).toBeDefined();
	});

	it("has init command", () => {
		const program = createProgram();
		const init = program.commands.find((c) => c.name() === "init");
		expect(init).toBeDefined();
	});

	it("has list command", () => {
		const program = createProgram();
		const list = program.commands.find((c) => c.name() === "list");
		expect(list).toBeDefined();
	});

	it("apply command has --dry-run option", () => {
		const apply = getCommand("apply");
		const opts = apply.options.map((o) => o.long);
		expect(opts).toContain("--dry-run");
	});

	it("apply command has --readme option", () => {
		const apply = getCommand("apply");
		const opts = apply.options.map((o) => o.long);
		expect(opts).toContain("--readme");
	});

	it("doctor command has --timeout option", () => {
		const doctor = getCommand("doctor");
		const opts = doctor.options.map((o) => o.long);
		expect(opts).toContain("--timeout");
	});

	it("apply command has --package option", () => {
		const apply = getCommand("apply");
		const opts = apply.options.map((o) => o.long);
		expect(opts).toContain("--package");
	});

	it("apply command has --workspace option", () => {
		const apply = getCommand("apply");
		const opts = apply.options.map((o) => o.long);
		expect(opts).toContain("--workspace");
	});

	it("check command has --package option", () => {
		const check = getCommand("check");
		const opts = check.options.map((o) => o.long);
		expect(opts).toContain("--package");
	});

	it("check command has --workspace option", () => {
		const check = getCommand("check");
		const opts = check.options.map((o) => o.long);
		expect(opts).toContain("--workspace");
	});

	it("init command has --markers-only option", () => {
		const init = getCommand("init");
		const opts = init.options.map((o) => o.long);
		expect(opts).toContain("--markers-only");
	});
});
