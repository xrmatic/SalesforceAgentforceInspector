use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct LogEvent {
    pub line_number: usize,
    pub timestamp: Option<String>,
    pub raw: String,
    pub detail: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct Summary {
    pub total_events: usize,
    pub planning_count: usize,
    pub grounding_count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ParseResult {
    pub agent_planning_events: Vec<LogEvent>,
    pub data_grounding_events: Vec<LogEvent>,
    pub summary: Summary,
}

#[wasm_bindgen]
pub fn parse_log(log: &str) -> JsValue {
    let mut agent_planning_events: Vec<LogEvent> = Vec::new();
    let mut data_grounding_events: Vec<LogEvent> = Vec::new();

    for (idx, line) in log.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let timestamp = extract_timestamp(line);

        if line.contains("AGENT_PLANNING") {
            let detail = extract_detail(line, "AGENT_PLANNING");
            agent_planning_events.push(LogEvent {
                line_number: idx + 1,
                timestamp,
                raw: line.to_string(),
                detail,
            });
        } else if line.contains("DATA_GROUNDING") {
            let detail = extract_detail(line, "DATA_GROUNDING");
            data_grounding_events.push(LogEvent {
                line_number: idx + 1,
                timestamp,
                raw: line.to_string(),
                detail,
            });
        }
    }

    let total = agent_planning_events.len() + data_grounding_events.len();
    let planning_count = agent_planning_events.len();
    let grounding_count = data_grounding_events.len();

    let result = ParseResult {
        agent_planning_events,
        data_grounding_events,
        summary: Summary {
            total_events: total,
            planning_count,
            grounding_count,
        },
    };

    serde_json::to_string(&result)
        .map(|s| JsValue::from_str(&s))
        .unwrap_or(JsValue::NULL)
}

fn extract_timestamp(line: &str) -> Option<String> {
    let re_like = line.chars().take(12).collect::<String>();
    if re_like.len() >= 8 {
        let chars: Vec<char> = re_like.chars().collect();
        if chars[2] == ':' && chars[5] == ':' {
            return Some(re_like.split('|').next().unwrap_or("").to_string());
        }
    }
    None
}

fn extract_detail(line: &str, event_type: &str) -> serde_json::Value {
    if let Some(pos) = line.find(event_type) {
        let after = &line[pos + event_type.len()..];
        let detail_str = after.trim_start_matches(|c| c == '|' || c == ' ');
        if let Ok(v) = serde_json::from_str(detail_str) {
            return v;
        }
        return serde_json::Value::String(detail_str.to_string());
    }
    serde_json::Value::Null
}
