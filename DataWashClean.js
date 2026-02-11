/* [Strict Maintenance Mode] 
Part Name: DataWashClean_V2.2_Full_Logic_Final
Task: Incremental Accumulation + Global Regex Scan + Ghost Buster (Purification)
Compliance: ANTI_STUPID_LOGIC_V3_PERMANENT (ZERO OMISSION)
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate.json';
const YAML_OUTPUT_FILE = 'Candidate_config.yaml';
const HINT_MAYBE_FILE = 'hint-maybeuseful.yml';

/**
 * 物理净化：除灵逻辑
 * 严格保留：字母、数字、连字符、下划线、斜杠、点。
 * 物理抹除：骷髅头、Emoji、不可见杂质。
 */
function purify(str) {
    if (!str) return "";
    return str.toString().replace(/[^\w\-\.\/]/gi, '');
}

/**
 * 像素级安全解码：物理剔除不可见字符 [cite: 2026-02-09]
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

        // VMESS 深度炼化
        if (line.startsWith('vmess://')) {
            const raw = line.replace('vmess://', '');
            const n = JSON.parse(safeBase64Decode(raw));
            const addr = n.add.toLowerCase();
            
            // 物理清洗假地址与超长垃圾
            if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

            return {
                fp: `VMESS-${n.add}-${n.port}-${n.path || ''}`,
                data: { 
                    type: 'VMESS', 
                    address: n.add, 
                    port: parseInt(n.port), 
                    id: purify(n.id), // 净化 UUID
                    aid: parseInt(n.aid) || 0, 
                    net: n.net || "tcp", 
                    path: purify(n.path || ""), // 净化 Path
                    tls: n.tls || "", 
                    sni: purify(n.sni || n.host || "") // 净化 SNI
                }
            };
        }

        // SS/VLESS/Trojan 深度炼化
        const u = new URL(line);
        const protocol = u.protocol.replace(':', '').toUpperCase();
        const addr = u.hostname.toLowerCase();
        
        // 物理清洗假地址
        if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

        const params = {};
        u.searchParams.forEach((v, k) => { params[k] = v; });

        let nodeData = {
            type: protocol, 
            address: u.hostname, 
            port: parseInt(u.port),
            net: params.type || params.net || "tcp", 
            path: purify(params.path || u.pathname || ""), // 净化
            security: params.security || (u.port === "443" ? "tls" : "none"),
            sni: purify(params.sni || params.host || u.hostname), // 净化
            pbk: purify(params.pbk || ""), 
            sid: purify(params.sid || ""), 
            flow: params.flow || ""
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
            nodeData.id = purify(u.username || params.id || ""); // 净化
            nodeData.password = u.username || params.password || "";
        }

        if (isNaN(nodeData.port) || nodeData.port <= 0) return null;
        return { fp: `${protocol}-${nodeData.address}-${nodeData.port}`, data: nodeData };
    } catch (e) { return null; }
}

async function main() {
    console.log("🛠️ [小七] 正在执行全量 V2.2 炼化（灵魂净化模式）...");
    
    const nodesMap = new Map();
    const maybeUsefulSet = new Set();
    
    // --- 增量蓄水逻辑：读取旧情报 ---
    if (fs.existsSync(HINT_MAYBE_FILE)) {
        try {
            const oldContent = fs.readFileSync(HINT_MAYBE_FILE, 'utf8');
            const oldUrls = oldContent.match(/https?:\/\/[^\s"';<>{}|[\]^`\\]+/g);
            if (oldUrls) {
                oldUrls.forEach(url => maybeUsefulSet.add(url));
            }
        } catch (e) {
            console.log("⚠️ 读取旧情报失败，跳过增量阶段。");
        }
    }

    if (!fs.existsSync(MEET_DIR)) {
        console.log("❌ 错误：Meet 目录物理缺失。");
        return;
    }

    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));
    
    files.forEach(file => {
        const filePath = path.join(MEET_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 自动判定 Base64 整体编码
        let effective = (content.includes('://') || content.length < 50) ? content : safeBase64Decode(content);
        
        effective.split(/\r?\n/).forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // 1. 节点协议尝试解析
            const res = parseProtocolLink(cleanLine);
            if (res) {
                nodesMap.set(res.fp, res.data);
                return; 
            }

            // 2. 全场 URL 雷达深度扫描
            const urlsFound = cleanLine.match(/https?:\/\/[^\s"';<>{}|[\]^`\\]+/g);
            if (urlsFound) {
                urlsFound.forEach(u => {
                    // 物理处决 t.me 广告
                    if (u.toLowerCase().includes('t.me')) return;
                    // 积攒资产
                    maybeUsefulSet.add(u);
                });
            }
        });
    });

    // 物理产出 Candidate.json
    const finalNodes = Array.from(nodesMap.values()).map((n, i) => { 
        n.index = i + 1; 
        return n; 
    });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2));

    // 物理产出 Candidate_config.yaml (完整 Clash 格式)
    let yaml = "proxies:\n";
    finalNodes.forEach(n => {
        const name = `Node-${n.index}`;
        if (n.type === 'VMESS') {
            yaml += `  - {name: "${name}", type: vmess, server: ${n.address}, port: ${n.port}, uuid: "${n.id}", alterId: ${n.aid}, cipher: auto, network: ${n.net}, ws-opts: {path: "${n.path}"}, tls: ${n.tls?true:false}, skip-cert-verify: true, sni: "${n.sni}"}\n`;
        } else if (n.type === 'SS') {
            yaml += `  - {name: "${name}", type: ss, server: ${n.address}, port: ${n.port}, cipher: ${n.method}, password: "${n.password}"}\n`;
        }
    });
    yaml += "\nproxy-groups:\n  - {name: \"🚀 节点选择\", type: select, proxies: [\"DIRECT\"]}\nrules:\n  - MATCH,DIRECT\n";
    fs.writeFileSync(YAML_OUTPUT_FILE, yaml);

    // 物理产出增量情报蓄水池
    if (maybeUsefulSet.size > 0) {
        const hintContent = Array.from(maybeUsefulSet).sort().map(link => `- ${link}`).join('\n');
        fs.writeFileSync(HINT_MAYBE_FILE, `# 炼化厂情报存档 V2.2\n# 每3天执行一次物理清空\n\n${hintContent}`);
    }

    console.log(`✅ 炼化任务全量完成！`);
    console.log(`💎 有效节点：${finalNodes.length}`);
    console.log(`🔍 累计资产：${maybeUsefulSet.size}`);
}

main().catch(err => { 
    console.error("🔥 炼化厂发生物理故障:", err);
    process.exit(1); 
});
