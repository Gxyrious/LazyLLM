#!/usr/bin/env bash
# Writer Benchmark 全量运行脚本
#
# 用法:
#   bash scripts/full_run.sh [场景...] [--cases 1,2,3] [--base-url http://localhost:8090]
#   场景: 1_multi_section 2_given_outline 3_revise_given (默认全部)
#
# 输出:
#   reports/<时间戳>/<场景>/traces/case_N.json   每条 trace
#   reports/<时间戳>/<场景>/stats.json            每个场景的统计
#   reports/<时间戳>/report.md                    汇总报告（所有场景合并）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCH_DIR="$(dirname "$SCRIPT_DIR")"
CASES_DIR="$BENCH_DIR/cases"
REPORTS_DIR="$BENCH_DIR/reports"
CHAT_CONTAINER="lazymind-chat-1"
BASE_URL="http://localhost:8090"
CASES=""

SCENARIOS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --cases) CASES="$2"; shift 2 ;;
        --base-url) BASE_URL="$2"; shift 2 ;;
        1_multi_section|2_given_outline|3_revise_given) SCENARIOS+=("$1"); shift ;;
        *) shift ;;
    esac
done

if [[ ${#SCENARIOS[@]} -eq 0 ]]; then
    SCENARIOS=(1_multi_section 2_given_outline 3_revise_given)
fi
if [[ -z "$CASES" ]]; then
    CASES="1 2 3 4 5"
fi
CASES=${CASES//,/ }

scenario_key() {
    case "$1" in
        1_multi_section) echo "multi" ;;
        2_given_outline) echo "outline" ;;
        3_revise_given) echo "revise" ;;
    esac
}

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_DIR="$REPORTS_DIR/$TIMESTAMP"
mkdir -p "$RUN_DIR"
echo "=== 运行目录: $RUN_DIR ==="

docker exec "$CHAT_CONTAINER" mkdir -p /opt/benchmark/cases
docker cp "$SCRIPT_DIR/reset_feishu_doc.py" "$CHAT_CONTAINER:/opt/benchmark/reset_feishu_doc.py"
docker cp "$CASES_DIR/." "$CHAT_CONTAINER:/opt/benchmark/cases/"

for SCENARIO in "${SCENARIOS[@]}"; do
    KEY=$(scenario_key "$SCENARIO")
    SCENARIO_DIR="$CASES_DIR/$SCENARIO"
    OUT_DIR="$RUN_DIR/$SCENARIO"
    mkdir -p "$OUT_DIR/traces"

    echo ""
    echo "=== 场景: $SCENARIO ==="

    TRACE_FILES=()
    for CASE_NUM in $CASES; do
        PROMPT_FILE="$SCENARIO_DIR/prompt_${CASE_NUM}.md"
        if [[ ! -f "$PROMPT_FILE" || ! -s "$PROMPT_FILE" ]]; then
            echo "[Case $CASE_NUM] 跳过（提示词文件缺失或为空）"
            continue
        fi

        echo "[Case $CASE_NUM] 开始..."

        if [[ "$SCENARIO" == "3_revise_given" ]]; then
            DOC_FILE="$SCENARIO_DIR/document_${CASE_NUM}.md"
            FEISHU_URL=$(python3 -c "
import re
text = open('$PROMPT_FILE').read()
urls = re.findall(r'https?://[^\s\")]+', text)
print(urls[0] if urls else '')
")
            if [[ -z "$FEISHU_URL" ]]; then
                echo "[Case $CASE_NUM] 错误: 提示词中未找到飞书 URL"
                exit 1
            fi
            if [[ ! -f "$DOC_FILE" ]]; then
                echo "[Case $CASE_NUM] 错误: 文档文件不存在: $DOC_FILE"
                exit 1
            fi
            echo "[Case $CASE_NUM] 重置飞书文档: $FEISHU_URL"
            docker exec "$CHAT_CONTAINER" python3 /opt/benchmark/reset_feishu_doc.py \
                "$FEISHU_URL" "/opt/benchmark/cases/$SCENARIO/document_${CASE_NUM}.md"
        fi

        echo "[Case $CASE_NUM] 发送请求..."
        RESULT=$(python3 "$SCRIPT_DIR/run_case.py" "$PROMPT_FILE" --base-url "$BASE_URL")
        CONV_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['conversation_id'])")
        ELAPSED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['elapsed_s'])")
        echo "[Case $CASE_NUM] 完成，耗时 ${ELAPSED}s，conversation_id=$CONV_ID"

        echo "[Case $CASE_NUM] 获取 trace..."
        TRACE_FILE="$OUT_DIR/traces/case_${CASE_NUM}.json"
        python3 "$SCRIPT_DIR/fetch_trace.py" "$CONV_ID" --out "$TRACE_FILE"
        TRACE_FILES+=("$TRACE_FILE")
        echo ""
    done

    if [[ ${#TRACE_FILES[@]} -gt 0 ]]; then
        echo "=== 计算统计: $SCENARIO ==="
        python3 "$SCRIPT_DIR/compute_stats.py" "${TRACE_FILES[@]}" --scenario "$KEY" > "$OUT_DIR/stats.json"
        echo "已保存: $OUT_DIR/stats.json"
    fi
done

echo ""
echo "=== 汇总性能数据 ==="
python3 "$SCRIPT_DIR/dump_stats.py" "$RUN_DIR"
echo "数据已汇总: $RUN_DIR/stats_overview.md"
echo "请读取 stats_overview.md 和 references/ 模板，自行生成 $RUN_DIR/report.md"
