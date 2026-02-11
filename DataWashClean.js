/* [Strict Maintenance Mode] 
Part Name: DataWashClean_V2.1_Full_Scan
Task: Protocol Extraction + Global Regex URL Triage
Logic: 1. Parse Nodes 2. Scan ALL URLs 3. Discard t.me 4. Save Useful Links
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate.json';
const YAML_OUTPUT_FILE = 'Candidate_config.yaml';
const HINT_MAYBE_FILE = 'hint-maybeuseful.yml';

// 像素级安全解码
function safeBase64Decode(str) {
    try {
        const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8').replace(/\0/g, '');
    } catch (e) { return str; }
}

// 协议解析核心
function parseProtocolLink(link) {
    try {
        const line = link.trim();
        if (!line || !line.includes('://')) return null;

        if (line.startsWith('vmess://')) {
            const raw = line.replace('vmess://', '');
            const n = JSON.parse(safeBase64Decode(raw));
            const addr = n.add.toLowerCase();
            // 物理清洗假节点
            if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

            return {
                fp: `VMESS-${n.add}-${n.port}-${n.path || ''}`,
                data: { type: 'VMESS', address: n.add, port: parseInt(n.port), id: n.id, aid: parseInt(n.aid) || 0, net: n.net || "tcp", path: n.path || "", tls: n.tls || "", sni: n.sni || n.host || "" }
            };
        }

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
    console.log("🛠️ [小七] 炼化厂 V2.1 启动：执行全场深度扫描...");
    const nodesMap = new Map();
    const maybeUsefulSet = new Set();
    
    if (!fs.existsSync(MEET_DIR)) return;

    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));
    
    files.forEach(file => {
        const content = fs.readFileSync(path.join(MEET_DIR, file), 'utf8');
        let effective = (content.includes('://') || content.length < 50) ? content : safeBase64Decode(content);
        
        effective.split(/\r?\n/).forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // 1. 尝试解析节点
            const res = parseProtocolLink(cleanLine);
            if (res) {
                nodesMap.set(res.fp, res.data);
                return; // 如果是节点，处理完直接跳过
            }

            // 2. 全场深抠链接 (正则雷达扫描)
            // 匹配 http/https 链接，直到遇到空格、引号或常见分割符
            const urls = cleanLine.match(/https?:\/\/[^\s"';<>{}|[\]^`\\]+/g);
            if (urls) {
                urls.forEach(u => {
                    // 物理处决 t.me 链接
                    if (u.toLowerCase().includes('t.me')) return;
                    
                    // 只要包含 http 且不是节点，全部记录入 maybeUsefulSet
                    maybeUsefulSet.add(u);
                });
            }
        });
    });

    // 导出节点
    const finalNodes = Array.from(nodesMap.values()).map((n, i) => { n.index = i + 1; return n; });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2));

    // 导出 YAML (Clash)
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

    // 导出情报：一个一行，严格去重
    if (maybeUsefulSet.size > 0) {
        const hintLines = Array.from(maybeUsefulSet).sort().map(link => `- ${link}`).join('\n');
        fs.writeFileSync(HINT_MAYBE_FILE, `# 炼化厂情报 V2.1\n# 已物理剔除所有 t.me 广告\n\n${hintLines}`);
    }

    console.log(`✅ 炼化结束！发现节点 ${finalNodes.length} 条，情报 ${maybeUsefulSet.size} 条。`);
}

main().catch(err => { console.error(err); process.exit(1); });
