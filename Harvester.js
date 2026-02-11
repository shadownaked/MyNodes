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
/**
 * 主程序：西点军校采集核心
 */
async function start() {
    console.log("====================================================");
    console.log("🏗️  西点军校 V2.0 (Harvester Cloud) 启动");
    console.log("====================================================");

    if (!fs.existsSync(SOURCE_FILE)) {
        console.log("❌ 错误：根目录未发现 sourceList.txt");
        process.exit(1);
    }

    // 1. 读取并解析 sourceList.txt，物理过滤注释行和空行
    const rawLines = fs.readFileSync(SOURCE_FILE, 'utf8').split(/\r?\n/).map(l => l.trim());
    const validTasks = [];
    
    rawLines.forEach((line) => {
        if (line && !line.startsWith('#') && line.startsWith('http')) {
            validTasks.push(line);
        }
    });

    console.log(`📡 发现 ${validTasks.length} 个有效情报源，准备按序采集...`);

    const allHints = new Set();

    // 2. 核心迭代循环：确保索引与 MeetXX.txt 对齐
    for (let i = 0; i < validTasks.length; i++) {
        const url = validTasks[i];
        // 索引补齐：01, 02...
        const index = (i + 1).toString().padStart(2, '0');
        const targetFile = path.join(MEET_DIR, `Meet${index}.txt`);

        // --- 随机冷却逻辑 20s-30s ---
        if (i > 0) {
            const cd = Math.floor(Math.random() * 11 + 20);
            console.log(`\n⏳ 触发防封策略，安全冷却 ${cd}s...`);
            await sleep(cd * 1000);
        }

        console.log(`🚀 [源 ${index}] 正在抓取: ${url.substring(0, 50)}...`);

        try {
            const content = await fetchUrl(url);
            
            if (content && content.length > 0) {
                // A. 提取情报 (Hints)
                const hints = extractHints(content);
                hints.forEach(h => allHints.add(h));

                // B. 物理写入：覆盖当前源的生肉
                fs.writeFileSync(targetFile, content);
                console.log(`✅ [源 ${index}] 采集成功! 长度: ${content.length}`);
            }
        } catch (e) {
            // C. 增量保护：如果失败，绝不删除旧文件，直接跳过
            console.log(`❌ [源 ${index}] 抓取失败: ${e.message}`);
            console.log(`⚠️ 触发容错保护：保留原有 ${targetFile} 存档，跳过此源。`);
        }
    }

    // 3. 产出情报文件 hint.yml
    if (allHints.size > 0) {
        const hintContent = Array.from(allHints).map(h => `- ${h}`).join('\n');
        fs.writeFileSync(HINT_FILE, `# 西点军校情报简报\n# 提取时间: ${new Date().toLocaleString()}\n\n${hintContent}`);
        console.log(`\n🔍 情报整理完毕，共发现 ${allHints.size} 条广告/说明链接，已存入 ${HINT_FILE}`);
    }

    console.log("\n====================================================");
    console.log("🏁 西点军校采集任务完成。接下来请执行炼化厂逻辑。");
    console.log("====================================================");
}

// 启动
start().catch(err => {
    console.error("🔥 军校指挥系统崩溃:", err);
    process.exit(1);
});
