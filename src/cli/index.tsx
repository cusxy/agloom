#!/usr/bin/env node

/**
 * CLI entry point.
 * Spec: docs/specs/cli.md § Entry point
 */

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

const args = process.argv.slice(2);
render(React.createElement(App, { args }));
