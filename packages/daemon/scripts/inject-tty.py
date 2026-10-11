#!/usr/bin/env python3
import sys
import os
import fcntl
import termios
import subprocess

def get_agy_tty():
    try:
        out = subprocess.check_output(['ps', '-eo', 'pid,tty,comm']).decode()
        for line in out.splitlines():
            if 'agy' in line and 'grep' not in line:
                parts = line.strip().split()
                if len(parts) >= 3 and parts[2].endswith('agy'):
                    tty = parts[1]
                    if not tty.startswith('/dev/'):
                        tty = '/dev/' + tty
                    if os.path.exists(tty):
                        return tty
    except Exception:
        pass
    return None

def main():
    if len(sys.argv) < 2:
        sys.exit(1)
    
    text = sys.argv[1]
    add_newline = True
    if len(sys.argv) > 2 and sys.argv[2] == '0':
        add_newline = False
    
    if add_newline and not text.endswith('\n'):
        text += '\n'
        
    tty_path = get_agy_tty()
    if not tty_path:
        sys.stderr.write("Could not find active agy TTY\n")
        sys.exit(2)
        
    try:
        fd = os.open(tty_path, os.O_RDWR)
        for ch in text:
            fcntl.ioctl(fd, termios.TIOCSTI, ch.encode('utf-8'))
        os.close(fd)
        print(f"Successfully injected {repr(text)} into {tty_path}")
    except Exception as e:
        sys.stderr.write(f"TIOCSTI injection error: {e}\n")
        sys.exit(3)

if __name__ == '__main__':
    main()
