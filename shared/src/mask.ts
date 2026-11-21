// AI-REQ-03: 외부 모델로 보내기 전에 개인정보 패턴을 가린다.
// ponytail: 대표 패턴(휴대폰·지역번호 전화, 차량번호)만 처리. 이메일·주민번호 등은 필요 시 추가.
const PHONE = /(?<!\d)0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const PLATE = /(?<!\d)\d{2,3}\s?[가-힣]\s?\d{4}(?!\d)/g;

export function maskPersonalInfo(text: string): string {
  return text.replace(PHONE, '[전화번호]').replace(PLATE, '[차량번호]');
}
