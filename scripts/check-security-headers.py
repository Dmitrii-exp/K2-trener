"""Read-only production header verification; no authentication or paid requests."""
import sys
from urllib.request import Request, urlopen

EXPECTED = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
}

def check(url):
    with urlopen(Request(url, method='GET'), timeout=20) as response:
        if not response.url.startswith('https://'):
            raise RuntimeError('Final URL must use HTTPS')
        failed = []
        for name, expected in EXPECTED.items():
            actual = response.headers.get_all(name) or []
            ok = len(actual) == 1 and actual[0] == expected
            print(f'{"PASS" if ok else "FAIL"}: {name}: {actual}')
            if not ok:
                failed.append(name)
        return not failed

if __name__ == '__main__':
    sys.exit(0 if check(sys.argv[1] if len(sys.argv) > 1 else 'https://app.sale-trener.ru/') else 1)
