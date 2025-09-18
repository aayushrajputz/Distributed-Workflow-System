import { sanitizeCSS } from '@/lib/security';

describe('sanitizeCSS', () => {
  it('should preserve valid CSS custom properties', () => {
    const validCSS = `
      .chart { --color-primary: #ff0000; }
      .dark .chart { --color-secondary: rgb(255, 0, 0); }
    `;
    const result = sanitizeCSS(validCSS);
    expect(result).toContain('--color-primary: #ff0000');
    expect(result).toContain('--color-secondary: rgb(255, 0, 0)');
  });

  it('should remove CSS comments', () => {
    const cssWithComments = `
      /* This is a comment */
      .chart { --color-primary: #ff0000; }
      /* Another comment */
    `;
    const result = sanitizeCSS(cssWithComments);
    expect(result).not.toContain('/* This is a comment */');
    expect(result).not.toContain('/* Another comment */');
    expect(result).toContain('--color-primary: #ff0000');
  });

  it('should remove dangerous @import rules', () => {
    const cssWithImport = `
      @import url('http://evil.com/malicious.css');
      .chart { --color-primary: #ff0000; }
    `;
    const result = sanitizeCSS(cssWithImport);
    expect(result).not.toContain('@import');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('--color-primary: #ff0000');
  });

  it('should remove expression() calls', () => {
    const cssWithExpression = `
      .chart { 
        --color-primary: #ff0000;
        width: expression(alert('XSS'));
      }
    `;
    const result = sanitizeCSS(cssWithExpression);
    expect(result).not.toContain('expression');
    expect(result).not.toContain('alert');
    expect(result).toContain('--color-primary: #ff0000');
  });

  it('should sanitize dangerous URLs in url() functions', () => {
    const cssWithDangerousUrl = `
      .chart { 
        --color-primary: #ff0000;
        background: url('javascript:alert(1)');
        background2: url('data:text/html,<script>alert(1)</script>');
        background3: url('https://example.com/image.png');
        background4: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
      }
    `;
    const result = sanitizeCSS(cssWithDangerousUrl);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('data:text');
    expect(result).toContain('https://example.com/image.png');
    expect(result).toContain('data:image/png');
    expect(result).toContain('--color-primary: #ff0000');
  });

  it('should remove HTML tags', () => {
    const cssWithHtml = `
      <script>alert('XSS')</script>
      .chart { --color-primary: #ff0000; }
      <iframe src="javascript:alert(1)"></iframe>
    `;
    const result = sanitizeCSS(cssWithHtml);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<iframe>');
    expect(result).not.toContain('alert');
    expect(result).toContain('--color-primary: #ff0000');
  });

  it('should validate custom property names', () => {
    const cssWithInvalidProps = `
      .chart { 
        --color-valid: #ff0000;
        --color-<script>: #00ff00;
        --color-normal_prop: #0000ff;
      }
    `;
    const result = sanitizeCSS(cssWithInvalidProps);
    expect(result).toContain('--color-valid: #ff0000');
    expect(result).toContain('--color-normal_prop: #0000ff');
    expect(result).not.toContain('--color-<script>');
    expect(result).not.toContain('<script>');
  });

  it('should handle empty or invalid input', () => {
    expect(sanitizeCSS('')).toBe('');
    expect(sanitizeCSS(null as any)).toBe('');
    expect(sanitizeCSS(undefined as any)).toBe('');
    expect(sanitizeCSS(123 as any)).toBe('');
  });

  it('should preserve valid color formats', () => {
    const cssWithColors = `
      .chart { 
        --color-hex3: #f00;
        --color-hex6: #ff0000;
        --color-hex8: #ff0000ff;
        --color-rgb: rgb(255, 0, 0);
        --color-rgba: rgba(255, 0, 0, 0.5);
        --color-hsl: hsl(0, 100%, 50%);
        --color-hsla: hsla(0, 100%, 50%, 0.5);
        --color-var: var(--color-primary);
      }
    `;
    const result = sanitizeCSS(cssWithColors);
    expect(result).toContain('--color-hex3: #f00');
    expect(result).toContain('--color-hex6: #ff0000');
    expect(result).toContain('--color-hex8: #ff0000ff');
    expect(result).toContain('--color-rgb: rgb(255, 0, 0)');
    expect(result).toContain('--color-rgba: rgba(255, 0, 0, 0.5)');
    expect(result).toContain('--color-hsl: hsl(0, 100%, 50%)');
    expect(result).toContain('--color-hsla: hsla(0, 100%, 50%, 0.5)');
    expect(result).toContain('--color-var: var(--color-primary)');
  });
});