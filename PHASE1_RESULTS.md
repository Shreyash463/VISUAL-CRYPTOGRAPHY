# Phase 1 Benchmark Results

| Size | Mode | n | Pixel Expansion | Relative Difference | Theoretical | Worst Leakage Max Deviation | Leakage All Passed | Median Processing (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 64x64 | overlay | 2 | 4.0 | 0.5 | 0.5 | 0.00000 | True | 0.22 |
| 64x64 | xor | 2 | 1.0 | 1.0 | 1.0 | 0.00887 | True | 0.01 |
| 64x64 | xor | 4 | 1.0 | 1.0 | 1.0 | 0.02162 | True | 0.01 |
| 64x64 | xor | 6 | 1.0 | 1.0 | 1.0 | 0.03381 | True | 0.02 |
| 128x128 | overlay | 2 | 4.0 | 0.5 | 0.5 | 0.00000 | True | 0.83 |
| 128x128 | xor | 2 | 1.0 | 1.0 | 1.0 | 0.00887 | True | 0.02 |
| 128x128 | xor | 4 | 1.0 | 1.0 | 1.0 | 0.00894 | True | 0.03 |
| 128x128 | xor | 6 | 1.0 | 1.0 | 1.0 | 0.01298 | True | 0.06 |
| 256x256 | overlay | 2 | 4.0 | 0.5 | 0.5 | 0.00000 | True | 2.79 |
| 256x256 | xor | 2 | 1.0 | 1.0 | 1.0 | 0.00164 | True | 0.04 |
| 256x256 | xor | 4 | 1.0 | 1.0 | 1.0 | 0.00679 | True | 0.14 |
| 256x256 | xor | 6 | 1.0 | 1.0 | 1.0 | 0.00412 | True | 0.21 |
| 512x512 | overlay | 2 | 4.0 | 0.5 | 0.5 | 0.00000 | True | 12.88 |
| 512x512 | xor | 2 | 1.0 | 1.0 | 1.0 | 0.00217 | True | 0.37 |
| 512x512 | xor | 4 | 1.0 | 1.0 | 1.0 | 0.00415 | True | 0.62 |
| 512x512 | xor | 6 | 1.0 | 1.0 | 1.0 | 0.00365 | True | 0.81 |

Processing time is reported, not targeted (NFR-5).
