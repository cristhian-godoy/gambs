import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SketchCanvas from './SketchCanvas.tsx';

describe('SketchCanvas', () => {
  it('renders coordinate display', () => {
    render(<SketchCanvas />);
    expect(screen.getByText(/X: 0.00 | Y: 0.00 mm/i)).toBeInTheDocument();
  });
});
