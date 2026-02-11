/* [Strict Maintenance Mode] 
Part Name: Harvester_V2.0_Cloud
Task: Secure Gathering & Content Splitting
Compliance: Gemini Development Protocol (Zero Omission)
Adjustment: 1. 基于行号生成 MeetXX.txt 2. 物理提取 hint.yml 3. 失败保留旧数据 4. 20-30s 随机冷却
*/

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_FILE = 'sourceList.txt';
const MEET_DIR = path.join(__dirname, 'Meet');
const HINT_FILE = 'hint.yml';

if (!fs.existsSync(MEET_DIR)) fs.mkdirSync(MEET_DIR);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 核心抓取函数：带 30s 超时控制，不使用代理插件，适配 GitHub Actions 环境
 */
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const timeout = 30000;
        const request = https.get(url, {
            timeout: timeout,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status Code: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        });

        request.on('error', (err) => reject(err));
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request Timeout (30s)'));
        });
    });
}

/**
 * 情报提取逻辑：将非协议链接存入 hint.yml
 */
function extractHints(content) {
    const hints = [];
    const lines = content.split(/\r?\n/);
    lines.forEach(line => {
        const clean = line.trim();
        // 如果包含 http 且不是已知的节点协议前缀，则视为情报
        if (clean.startsWith('http') && 
            !clean.startsWith('vmess://') && 
            !clean.startsWith('ss://') && 
            !clean.startsWith('vless://') && 
            !clean.startsWith('trojan://')) {
            hints.push(clean);
        }
    });
    return hints;
}
