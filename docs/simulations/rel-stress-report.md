# REL Stress Simulation: Anomalies, Whales, Buyer Flows

Unknown variables included:
- Random anomaly event shocks on daily emission
- REL buyer inflow process (stochastic daily flow)
- Whale cohort with high stake concentration
- Environmental noise factor on effective stake

Monte Carlo runs per scenario: **200**

| Scenario | Users/Cohort | Day250 BPS 1/day | Day250 BPS 3/day | Day250 BPS Whale | CumReward/User1 p50 | CumReward/User1 p95 | CumReward/User3 p50 | CumReward/User3 p95 | Whale Cum p50 | Whale Cum p95 | Daily Emission p50 | Daily Emission p95 | Anomaly Count p50 | Anomaly Count p95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 25 | 7000 | 19500 | 13250 | 113235.56 | 121349.13 | 247780.99 | 262455.82 | 5785985.23 | 6029304.00 | 51967.42 | 51967.42 | 15 | 21 |
| B | 100 | 7000 | 19500 | 13250 | 31298.67 | 33364.72 | 66106.94 | 69047.58 | 5429179.91 | 5627496.69 | 51967.42 | 51967.42 | 15 | 21 |
| C | 250 | 7000 | 19500 | 13250 | 14305.64 | 15064.73 | 29065.60 | 30077.57 | 4879425.81 | 5053873.65 | 51967.42 | 51967.42 | 15 | 21 |


## Day-250 Variable Snapshot (p50/p95)

### Scenario A (Users/Cohort=25)
- BPS day250: user1=7000, user3=19500, whale=13250
- Cum reward/user1: p50=113235.5641, p95=121349.1274
- Cum reward/user3: p50=247780.9864, p95=262455.8152
- Cum reward/whale: p50=5785985.2297, p95=6029304.0027
- Raw stake/user1: p50=233911.8337, p95=243935.6167
- Raw stake/user3: p50=409559.8029, p95=425856.4727
- Raw stake/whale: p50=7474485.2667, p95=7771142.0094
- Day250 emission: p50=51967.4231, p95=51967.4231
- Anomaly count over 250 days: p50=15, p95=21

### Scenario B (Users/Cohort=100)
- BPS day250: user1=7000, user3=19500, whale=13250
- Cum reward/user1: p50=31298.6707, p95=33364.7156
- Cum reward/user3: p50=66106.9450, p95=69047.5779
- Cum reward/whale: p50=5429179.9054, p95=5627496.6880
- Raw stake/user1: p50=61487.3224, p95=64298.1793
- Raw stake/user3: p50=106585.5865, p95=109639.9606
- Raw stake/whale: p50=7127635.0649, p95=7345626.2802
- Day250 emission: p50=51967.4231, p95=51967.4231
- Anomaly count over 250 days: p50=15, p95=21

### Scenario C (Users/Cohort=250)
- BPS day250: user1=7000, user3=19500, whale=13250
- Cum reward/user1: p50=14305.6445, p95=15064.7308
- Cum reward/user3: p50=29065.5992, p95=30077.5728
- Cum reward/whale: p50=4879425.8055, p95=5053873.6451
- Raw stake/user1: p50=26649.2056, p95=27696.1849
- Raw stake/user3: p50=45399.7191, p95=46530.3726
- Raw stake/whale: p50=6581363.6635, p95=6772377.6963
- Day250 emission: p50=51967.4231, p95=51967.4231
- Anomaly count over 250 days: p50=15, p95=21

