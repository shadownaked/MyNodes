/* [Strict Maintenance Mode] 
Part Name: DataWashClean_V2.1_Full_Logic
Task: Incremental Intelligence Accumulation & Node Refining
Compliance: ANTI_STUPID_LOGIC_V3_PERMANENT (Zero Omission)
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate.json';
const YAML_OUTPUT_FILE = 'Candidate_config.yaml';
const HINT_MAYBE_FILE = 'hint-maybeuseful.yml';

/**
 * 像素级安全解码：物理剔除不可见字符
 */
function safeBase64Decode(str) {
    try {
        const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8').replace(/\0/g, '');
    } catch (e) { return str; }
}

/**
 * 协议解析核心：执行 AD/广告物理清洗
 */
function parseProtocolLink(link) {
    try {
        const line = link.trim();
        if (!line || !line.includes('://')) return null;

        // VMESS 解析
        if (line.startsWith('vmess://')) {
            const raw = line.replace('vmess://', '');
            const n = JSON.parse(safeBase64Decode(raw));
            const addr = n.add.toLowerCase();
            // 物理清洗假地址
            if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

            return {
                fp: `VMESS-${n.add}-${n.port}-${n.path || ''}`,
                data: { type: 'VMESS', address: n.add, port: parseInt(n.port), id: n.id, aid: parseInt(n.aid) || 0, net: n.net || "tcp", path: n.path || "", tls: n.tls || "", sni: n.sni || n.host || "" }
            };
        }

        // SS/VLESS/Trojan 解析
        const u = new URL(line);
        const protocol = u.protocol.replace(':', '').toUpperCase();
        const addr = u.hostname.toLowerCase();
        if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

        const params = {};
        u.searchParams.forEach((v, k) => { params[k] = v; });

        let nodeData = {
            type: protocol, address: u.hostname, port: parseInt(u.port),
            net: params.type || params.net || "tcp", path: params.path || u.pathname || "",
            security: params.security || (u.port === "443" ? "tls" : "none"),
            sni: params.sni || params.host || u.hostname, pbk: params.pbk || "", sid: params.sid || "", flow: params.flow || ""
        };

        if (protocol === 'SS') {
            if (u.username) {
                const decoded = safeBase64Decode(u.username);
                if (decoded.includes(':')) {
                    const parts = decoded.split(':');
                    nodeData.method = parts[0];
                    nodeData.password = parts[1].replace(/[^\x20-\x7E]/g, '');
                }
            }
        } else {
            nodeData.id = u.username || params.id || "";
            nodeData.password = u.username || params.password || "";
        }

        if (isNaN(nodeData.port) || nodeData.port <= 0) return null;
        return { fp: `${protocol}-${nodeData.address}-${nodeData.port}`, data: nodeData };
    } catch (e) { return null; }
}

async function main() {
    console.log("🛠️ [小七] 正在执行增量炼化：全场深度扫描模式启动...");
    
    const nodesMap = new Map();
    const maybeUsefulSet = new Set();
    
    // --- 逻辑：读取旧情报，实现增量蓄水 ---
    if (fs.existsSync(HINT_MAYBE_FILE)) {
        const oldContent = fs.readFileSync(HINT_MAYBE_FILE, 'utf8');
        // 使用正则从旧文件中提取 http 链接进行初始化
        const oldUrls = oldContent.match(/https?:\/\/[^\s"';<>{}|[\]^`\\]+/g);
        if (oldUrls) {
            oldUrls.forEach(url => maybeUsefulSet.add(url));
        }
    }

    if (!fs.existsSync(MEET_DIR)) {
        console.log("❌ 错误：未发现 Meet 文件夹。");
        return;
    }

    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));
    
    files.forEach(file => {
        const content = fs.readFileSync(path.join(MEET_DIR, file), 'utf8');
        // 自动判定是否需要整体解码
        let effective = (content.includes('://') || content.length < 50) ? content : safeBase64Decode(content);
        
        effective.split(/\r?\n/).forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // 1. 尝试作为节点协议解析
            const res = parseProtocolLink(cleanLine);
            if (res) {
                nodesMap.set(res.fp, res.data);
                return; 
            }

            // 2. 如果不是节点，执行全场 URL 雷达扫描
            const urlsFound = cleanLine.match(/https?:\/\/[^\s"';<>{}|[\]^`\\]+/g);
            if (urlsFound) {
                urlsFound.forEach(u => {
                    // 物理处决：剔除包含 t.me 的广告
                    if (u.toLowerCase().includes('t.me')) return;
                    
                    // 精准营救：将所有非电报 http 链接（如 GitHub）存入蓄水池
                    maybeUsefulSet.add(u);
                });
            }
        });
    });

    // 导出 Candidate.json
    const finalNodes = Array.from(nodesMap.values()).map((n, i) => { n.index = i + 1; return n; });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2));

    // 导出 Candidate_config.yaml (完整配置模式)
    let yaml = "proxies:\n";
    finalNodes.forEach(n => {
        const name = `Node-${n.index}`;
        if (n.type === 'VMESS') {
            yaml += `  - {name: "${name}", type: vmess, server: ${n.address}, port: ${n.port}, uuid: ${n.id}, alterId: ${n.aid}, cipher: auto, network: ${n.net}, ws-opts: {path: "${n.path}"}, tls: ${n.tls?true:false}, skip-cert-verify: true, sni: "${n.sni}"}\n`;
        } else if (n.type === 'SS') {
            yaml += `  - {name: "${name}", type: ss, server: ${n.address}, port: ${n.port}, cipher: ${n.method}, password: "${n.password}"}\n`;
        }
    });
    yaml += "\nproxy-groups:\n  - {name: \"🚀 节点选择\", type: select, proxies: [\"DIRECT\"]}\nrules:\n  - MATCH,DIRECT\n";
    fs.writeFileSync(YAML_OUTPUT_FILE, yaml);

    // 导出情报：去重合并后的增量资产
    if (maybeUsefulSet.size > 0) {
        const hintContent = Array.from(maybeUsefulSet).sort().map(link => `- ${link}`).join('\n');
        fs.writeFileSync(HINT_MAYBE_FILE, `# 炼化厂情报存档 V2.1\n# 增量模式：每3天手动清空前将持续累积\n\n${hintContent}`);
    }

    console.log(`✅ 炼化结束！`);
    console.log(`💎 核心节点：${finalNodes.length} 条`);
    console.log(`🔍 累计情报：${maybeUsefulSet.size} 条 (已物理剔除 t.me)`);
}

main().catch(err => { console.error(err); process.exit(1); });
