// ---------------------------------------------------------------------------
// Components barrel file
// ---------------------------------------------------------------------------
//
// This module serves as the single entry point for all shared UI components.
// Consumers can import any component from "@/components" without needing to
// know the individual file paths.
//
// @example
// ```tsx
// import { Button, Card, CardHeader, CardTitle, Badge } from "@/components";
// ```

// ---------------------------------------------------------------------------
// Button — polymorphic button with variants, sizes, and loading state
// ---------------------------------------------------------------------------
export { Button } from "./Button";

// ---------------------------------------------------------------------------
// Card family — container, header, title, content, and footer
// ---------------------------------------------------------------------------
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./Card";

// ---------------------------------------------------------------------------
// Input — form input with label, icon, hint, and error state
// ---------------------------------------------------------------------------
export { Input } from "./Input";

// ---------------------------------------------------------------------------
// Badge — small status/category label with colour variants and sizes
// ---------------------------------------------------------------------------
export { Badge } from "./Badge";

// ---------------------------------------------------------------------------
// Header — sticky top-level navigation bar with mobile hamburger menu
// ---------------------------------------------------------------------------
export { Header } from "./Header";