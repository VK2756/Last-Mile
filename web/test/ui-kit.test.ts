import { describe, expect, it } from 'vitest';
import { buttonClass } from '../components/ui/Button';
import { eyebrowClass } from '../components/ui/SectionHeading';

describe('shared UI kit helpers', () => {
  it('buttonClass gives links the same styling as <Button>', () => {
    const c = buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' });
    expect(c).toContain('bg-accent');
    expect(c).toContain('h-12');
    expect(c).toContain('focus-visible:outline-accent');
    expect(c).toContain('w-full');
    expect(buttonClass()).toContain('bg-surface-2');
  });
  it('eyebrowClass is the one kicker style', () => {
    expect(eyebrowClass()).toContain('text-fire');
    expect(eyebrowClass('accent')).toContain('text-accent');
    expect(eyebrowClass()).toContain('tracking-[0.2em]');
  });
});
