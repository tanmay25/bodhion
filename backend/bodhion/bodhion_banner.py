"""
bodhion_banner.py
----------------
Prints a colored Bodhion startup banner using `rich`.

Color zones mapped from the Bodhion logo image:
  - Top disc body / outer ring  -> teal / cyan gradient
  - Left orbital sweep figure   -> green shades
  - Right side glow / chip area -> amber / yellow
  - Bottom closing arcs         -> blue
  - BODHION block letters        -> bright blue

Alignment: everything is mathematically centered under the ASCII art.
  Art leftmost col : 18
  Art rightmost col: 89
  Visual centre    : 53

Usage (in main.py):
    from bodhion_banner import print_banner

    if LOG_FORMAT != "json":
        print_banner(
            version=VERSION,
            build_hash=WEBUI_BUILD_HASH,
            url="https://github.com/tanmay-mondal/bodhion",
        )
"""

from rich.console import Console

_con = Console(highlight=False, markup=False)

# ── Alignment constants ──────────────────────────────────────────────────────
_C          = 53          # visual centre column of the ASCII art
_LOGO_W     = 43          # all 6 BODHION block-letter lines are exactly 43 chars
_SEP_W      = 57
_LOGO_PAD   = " " * (_C - _LOGO_W // 2)     # 32 spaces
_SEP_PAD    = " " * (_C - _SEP_W  // 2)     # 25 spaces
_SEP        = _SEP_PAD + "=" * _SEP_W

# Bullet block: all items share the same left edge, block is centered as a unit
_MODULES        = ["Document Chat", "Resume Analyzer", "Equipment Log Analyzer", "Wafer Vision AI"]
_BULLET_ITEMS   = [f"\u2022  {m}" for m in _MODULES]
_BULLET_MAX_W   = max(len(b) for b in _BULLET_ITEMS)   # 25 chars
_BULLET_PAD     = " " * (_C - _BULLET_MAX_W // 2)      # 41 spaces — fixed for all items

# Pre-padded BODHION block letters
_LOGO_LINES = [
    _LOGO_PAD + "\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557",
    _LOGO_PAD + "\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551",
    _LOGO_PAD + "\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551",
    _LOGO_PAD + "\u2588\u2588\u2551\u255a\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551",
    _LOGO_PAD + "\u2588\u2588\u2551 \u255a\u2550\u255d \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551",
    _LOGO_PAD + "\u255a\u2550\u255d     \u255a\u2550\u255d\u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d",
]


def _cpad(text: str) -> str:
    """Left-pad text so its visual centre aligns with the art's centre col."""
    return " " * (_C - len(text) // 2) + text


# ── ASCII art rows ───────────────────────────────────────────────────────────
_ROWS = [
    [
        ("                                             ", ""),
        (",:rX25hhMMMMhh32Asi:",                         "dark_cyan"),
    ],
    [
        ("                                        ",     ""),
        (":r5H#B&&@@@@@@@@@@@@@@@@&9GhAi.",             "cyan"),
    ],
    [
        ("                                     ",        ""),
        ("i2H9&@@@@@@&BB&&&@@@@@@@@@@@@@@@&9Ms.",        "cyan"),
        (" ,;rrr;,",                                     "dark_green"),
    ],
    [
        ("                                  ",           ""),
        (",s3HB&B9&@@@@@&&B&&&@@@@@@@@@@@@@@@@@@@93:",   "bright_cyan"),
        (" :rA352X:",                                    "dark_green"),
    ],
    [
        ("                                ",             ""),
        (",r3HSSSS####9B9#B99&&&&&&@@@@@@@@@@@@@@@@@@BA","bright_cyan"),
        ("   .3#BB9M;",                                  "green"),
    ],
    [
        ("                              ",               ""),
        (".iA23h3hMHHHGSHGS#BB&&&&&&&&&&&@@@@@@@@@@@@@@@@3", "bright_cyan"),
        ("  59&@&BG5,",                                  "green"),
    ],
    [
        ("                             ",                ""),
        (",ish5255553MMMGGB@@@@@@@@@@&&&&&&&&@@@@@@&&&@@@@&;", "bright_cyan"),
        (" i23hh35A.",                                   "bright_green"),
    ],
    [
        ("                            ",                 ""),
        (",Xh3XXX222555MGHS@@@@@@@@@@&9999999BBBBB&&&&9999B#;", "bright_cyan"),
        (" :2AAA2X",                                     "bright_green"),
    ],
    [
        ("                           ",                  ""),
        (",,Ah3XXAAA253hhMh&@@@@@@@@@@9S####SGGGS#99999GGH#G2.", "cyan"),
        (" M@&B9B5",                                     "yellow"),
    ],
    [
        ("                      ",                       ""),
        (",:,  ",                                        "dark_green"),
        (",:;rXAXA5h523HG5S@@@@@@@@&&&G#SMMMHHHHGGSS#ShhhHMX,", "cyan"),
        (".5&@@@@G:",                                    "yellow"),
    ],
    [
        ("                     ",                        ""),
        ("ir:, ",                                        "dark_green"),
        (",,22sssXXsr2As5hshGHHSMSSMGS323h553hhh33hhhMh55Mhr.", "dark_cyan"),
        (":H@@@@@hs;",                                   "bright_yellow"),
    ],
    [
        ("                    ",                         ""),
        ("A2:;, ",                                       "dark_green"),
        (".,ri::,:;X2i;3hXX3HsHGX#H2SHhhAX25522hHhh533533s,", "dark_cyan"),
        (":5B@@@@#XA5",                                  "bright_yellow"),
    ],
    [
        ("                   ",                          ""),
        ("sSsir,  ",                                     "dark_green"),
        (".A;:rXAAiirA2r;shXiGXXSXA#AX233AX25325BB3255s::", "dark_cyan"),
        ("29@@@@#A;hH",                                  "bright_yellow"),
    ],
    [
        ("                  ",                           ""),
        (".G9Airi  ",                                    "dark_green"),
        (".i:MB5:,2A;:,X5Arih2;3MXX3MAss3&MXX23A22AXi:", "dark_cyan"),
        ("rhB@@@&GX,X9G.",                               "yellow"),
    ],
    [
        ("                  ",                           ""),
        (";#BSsrs;  ",                                   "dark_green"),
        (".,::,,A2.,:3h;,iMs;iHAXXrhGsXAM5XXXXXr;:",    "cyan"),
        ("i5SB@@&#3i,i59M",                              "yellow"),
    ],
    [
        ("                  ",                           ""),
        (":9&@#AsXr, ",                                  "green"),
        (",;;::A:,,3&3;sSs;i59AAhsGBAXXAXsi;:;",        "cyan"),
        ("s3G9BB#G5r:;s23MA",                            "dark_goldenrod"),
    ],
    [
        ("                   ",                          ""),
        ("A&@@&G5XXr;,:;i:,,,;i:;SG;;;hS2r5ssXi;;:;",   "green"),
        ("iX3G9BB9SMAi;sAA352X:",                        "dark_goldenrod"),
    ],
    [
        ("                  ",                           ""),
        (": r#@@@&#H32Xri::,..    ,..,,,,,,,::;",        "bright_green"),
        ("rA3H#&@@@9H2r::i2HGMh3Ai",                    "yellow"),
    ],
    [
        ("                  ",                           ""),
        (",;  XG&@@@@B9SHh32AXsrriiirrsA25hHS9&@@@@&#H2r,.", "bright_green"),
        (":rX23h33h2i.",                                 "bright_yellow"),
    ],
    [
        ("                   ",                          ""),
        (",r,  :XM#B@@@@@@@&&BBBBB&&@@@@@@@@&9GhAi,",   "green"),
        ("  ,iX255hG9M3Ai",                              "bright_cyan"),
    ],
    [
        ("                     ",                        ""),
        ("is;    ,iX5hHG##9BBBB9##SGHh5Xr:.",            "green"),
        ("   ,iX2533333HB&SA:",                          "cyan"),
    ],
    [
        ("                       ",                      ""),
        (";sXr:.",                                       "dark_green"),
        ("                     ",                        ""),
        (".:rA3MHHMhhhhhhMGH2r.",                        "cyan"),
    ],
    [
        ("                          ",                   ""),
        (":rXAAAXsri;;;;iisXA53MGS##SHMh33hH99h35Xi,",   "dark_cyan"),
    ],
    [
        ("                              ",               ""),
        (",;isXA2553333352AXXssXXA3GhMM22X;,",           "cyan"),
    ],
    [
        ("                                    ",         ""),
        (".,,,::::::;iiXrXXisX;:,",                      "bright_cyan"),
    ],
    [
        ("                                              ", ""),
        ("..",                                           "dark_cyan"),
    ],
    [
        ("                                ",             ""),
        ("..,,:;;iirrsXAA2522AXXsri;::,,.",              "blue"),
    ],
    [
        ("                         ",                    ""),
        ("...,,,,,::;;irrssXA22555522AAXsri;;::,.",       "bright_blue"),
    ],
    [
        ("                            ..   ",            ""),
        (".,,,,,,,,,,,,,,,,.......    ",                  "grey30"),
    ],
]


def print_banner(
    version: str = "",
    build_hash: str = "",
    url: str = "https://github.com/tanmay-mondal/bodhion",
) -> None:
    """
    Print the colored Bodhion startup banner.

    Args:
        version    : App version string, e.g. "1.2.3". Displayed as "v1.2.3".
        build_hash : Git commit hash. Pass "dev-build" or "" to omit.
        url        : Project URL shown below the version line.

    Typical call from main.py::

        print_banner(
            version=VERSION,
            build_hash=WEBUI_BUILD_HASH,
            url="https://github.com/tanmay-mondal/bodhion",
        )

    Uses an isolated rich Console -- zero impact on existing loggers or
    print() calls anywhere else in the application.
    """
    # ── ASCII art ────────────────────────────────────────────────────────────
    for row in _ROWS:
        for i, (text, style) in enumerate(row):
            is_last = (i == len(row) - 1)
            if style:
                _con.print(text, style=style, end="\n" if is_last else "")
            else:
                _con.print(text, end="\n" if is_last else "")

    # ── BODHION block letters ─────────────────────────────────────────────────
    _con.print()
    for line in _LOGO_LINES:
        _con.print(line, style="bold bright_blue")
    _con.print()

    # ── Info panel ───────────────────────────────────────────────────────────
    _con.print(_SEP,                       style="grey23")
    _con.print(_cpad("Bodhion Platform"),   style="bold white")
    _con.print(_SEP,                       style="grey23")

    # Version line (only if version supplied)
    if version:
        ver_label = f"v{version} - Building the best AI workspace platform."
        _con.print(_cpad(ver_label),       style="grey62")

    # Commit hash (only if not dev-build / empty)
    if build_hash and build_hash not in ("dev-build", ""):
        _con.print(_cpad(f"Commit: {build_hash}"), style="grey42")

    # URL
    if url:
        _con.print(_cpad(url),             style="bright_blue")

    _con.print()

    # Startup line
    _con.print(_cpad("AI Workspace Framework Starting..."), style="grey62")
    _con.print()

    # Modules — entire bullet block centered as a unit (fixed left edge)
    _con.print(_cpad("Modules:"),          style="bold white")
    for item in _BULLET_ITEMS:
        _con.print(_BULLET_PAD + item,     style="cyan")
    _con.print()

    # Status line — label in grey, value in green, both centered together
    status_label = "Status:  "
    status_value = "Initializing Services..."
    full_status  = status_label + status_value
    pad          = " " * (_C - len(full_status) // 2)
    _con.print(pad + status_label,         style="grey62",    end="")
    _con.print(status_value,               style="bold green")
    _con.print(_SEP + "\n",                style="grey23")


#if __name__ == "__main__":
#    # Standalone test — simulates what main.py passes in
#    print_banner(
#        version="1.0.0",
#        build_hash="a3f9c12",
#        url="https://github.com/tanmay-mondal/bodhion",
#    )