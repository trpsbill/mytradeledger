// Runs before every client test file. Adds the jest-dom matchers (toBeInTheDocument,
// toHaveClass, …) and clears mock/localStorage state between tests so suites stay
// isolated.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement <dialog> native methods; stub them so Modal renders
// without throwing in tests.
HTMLDialogElement.prototype.showModal = function () {};
HTMLDialogElement.prototype.close = function () {};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
