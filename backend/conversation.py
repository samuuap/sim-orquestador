"""
Turning real planning output into a conversation.

The agents already produce everything a meeting would be about: the proposal the user wrote, the
CEO's feasibility call, the adjustments the PM makes to that breakdown, the risks, the open
questions, and who ends up owning what. This module renders that into spoken lines.

The point is that nothing here is filler. Every line is interpolated from the actual run, so the
conversation on screen is a readable account of the work that just happened rather than ambient
chatter. If the PM splits a task, you hear why. If a risk blocks the API, you hear it raised and
answered.
"""

from dataclasses import dataclass
from typing import List, Optional

DISPLAY_NAMES = {
    "ceo_001": "Robin",
    "pm_001": "Noa",
    "designer_001": "Ash",
    "developer_001": "Kai",
}

# Reading pace. Short lines still need a beat; long lines are capped so nobody monologues.
MIN_LINE_SECONDS = 2.0
MAX_LINE_SECONDS = 6.0
SECONDS_PER_CHARACTER = 1 / 24


@dataclass
class Line:
    """One spoken line in a meeting."""

    speaker: str
    text: str
    seconds: float


def _pace(text: str) -> float:
    return max(MIN_LINE_SECONDS, min(MAX_LINE_SECONDS, 1.0 + len(text) * SECONDS_PER_CHARACTER))


def _line(speaker: str, text: str) -> Line:
    text = " ".join(text.split())
    return Line(speaker=speaker, text=text, seconds=_pace(text))


def _trim(text: str, limit: int) -> str:
    """Shorten to a sentence-sized fragment without cutting mid-word."""
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}..."


def _first_sentence(text: str, limit: int = 120) -> str:
    text = " ".join(str(text).split())
    for stop in (". ", "; "):
        if stop in text:
            text = text.split(stop)[0]
            break
    return _trim(text, limit)


def briefing_script(proposal: str, ceo_output, pm_plan) -> List[Line]:
    """
    The CEO hands the request to the PM, and they argue it into a plan.

    `ceo_output` is a CEOOutput, `pm_plan` a PMOutput. Either may be None if that agent failed, in
    which case the conversation degrades to what is actually known rather than inventing content.
    """
    ceo, pm = "ceo_001", "pm_001"
    lines: List[Line] = []

    # The user is the client. The meeting opens by repeating back what they asked for.
    lines.append(_line(ceo, f'New request just came in: "{_trim(proposal, 130)}"'))

    if ceo_output is not None:
        evaluation = ceo_output.evaluation
        verdict = {
            "APPROVED": "I'm approving it",
            "NEEDS_CLARIFICATION": "I want it clarified before we commit",
            "NOT_FEASIBLE": "I don't think we can take it as written",
        }.get(evaluation.feasibility, "I've looked at it")
        lines.append(
            _line(
                ceo,
                f"{verdict}. Complexity is {evaluation.complexity.lower()}, "
                f"and I'd put it at {evaluation.estimated_timeline}.",
            )
        )
        if getattr(ceo_output, "requirements", None):
            top = ceo_output.requirements[0]
            lines.append(_line(ceo, f"The thing that matters most: {_first_sentence(top.description)}"))
        lines.append(
            _line(
                ceo,
                f"I've sketched {len(ceo_output.design_tasks)} design tasks and "
                f"{len(ceo_output.development_tasks)} development ones. It's yours from here.",
            )
        )

    lines.append(_line(pm, "Let me read it before I agree to anything."))

    if pm_plan is not None:
        for adjustment in pm_plan.brief_adjustments[:2]:
            lines.append(
                _line(pm, f"I'm going to {adjustment.kind} {_trim(adjustment.target, 60)}.")
            )
            lines.append(_line(pm, _first_sentence(adjustment.reason, 130)))
            lines.append(_line(ceo, "That's fair."))

        if not pm_plan.brief_adjustments:
            lines.append(_line(pm, "The breakdown holds up. I'd run it as written."))

        for risk in pm_plan.risks[:1]:
            lines.append(
                _line(pm, f"One thing worries me: {_first_sentence(risk.description, 110)}.")
            )
            lines.append(_line(pm, f"My plan is to {_first_sentence(risk.mitigation, 110).rstrip('.').lower()}."))
            lines.append(_line(ceo, "Do that."))

        for question in pm_plan.questions_for_ceo[:1]:
            lines.append(_line(pm, _trim(question, 130)))
            lines.append(_line(ceo, "Good question. Assume yes for now and flag it if it bites."))

        lines.append(
            _line(
                pm,
                f"Then it's {len(pm_plan.phases)} phases and {len(pm_plan.tasks)} tasks. "
                f"{_first_sentence(pm_plan.plan_summary, 130)}",
            )
        )
        lines.append(_line(ceo, "Go and brief the team."))
    else:
        lines.append(_line(pm, "I can't plan this yet. Something went wrong on my side."))

    return lines


def standup_script(pm_plan) -> List[Line]:
    """The PM assigns the work, and the team pushes back where it matters."""
    pm, designer, developer = "pm_001", "designer_001", "developer_001"
    lines: List[Line] = []

    if pm_plan is None:
        return [_line(pm, "I don't have a plan to give you yet. Give me a minute.")]

    # Trimmed rather than first-sentence: the brief opens with a short framing sentence, and
    # cutting there throws away the part that actually tells the team anything.
    lines.append(_line(pm, _trim(pm_plan.standup_brief, 160)))

    design_tasks = pm_plan.design_tasks
    dev_tasks = pm_plan.development_tasks

    # Delegation, by name, with the real task descriptions.
    if design_tasks:
        first = design_tasks[0]
        lines.append(
            _line(
                pm,
                f"{DISPLAY_NAMES[designer]}, you have {len(design_tasks)} "
                f"{'task' if len(design_tasks) == 1 else 'tasks'}. Start with "
                f"{_trim(first.description, 90)}.",
            )
        )
        lines.append(_line(designer, f"That's about {first.estimated_hours:g} hours. I can start now."))

    if dev_tasks:
        first = dev_tasks[0]
        blocked = [t for t in dev_tasks if t.depends_on]
        lines.append(
            _line(
                pm,
                f"{DISPLAY_NAMES[developer]}, {len(dev_tasks)} for you, beginning with "
                f"{_trim(first.description, 90)}.",
            )
        )
        if blocked:
            waiting = blocked[0]
            lines.append(
                _line(
                    developer,
                    f"{_trim(waiting.description, 70)} is blocked until "
                    f"{', '.join(waiting.depends_on)} lands, right?",
                )
            )
            lines.append(_line(pm, "Right. Don't start it before then."))
        else:
            lines.append(_line(developer, "Nothing blocking. I'll take them in priority order."))

    if pm_plan.phases:
        phase = pm_plan.phases[0]
        lines.append(_line(pm, f"Phase one is {phase.name}: {_first_sentence(phase.goal, 100)}"))

    for risk in pm_plan.risks[:1]:
        lines.append(_line(pm, f"Heads up: {_first_sentence(risk.description, 110)}."))
        lines.append(_line(developer, "I'll shout as soon as I hit it."))

    if design_tasks and dev_tasks:
        lines.append(
            _line(
                designer,
                f"{DISPLAY_NAMES[developer]}, I'll get you the layout before you build the list.",
            )
        )
        lines.append(_line(developer, "Works for me."))

    lines.append(_line(pm, "That's it. Let's go."))
    return lines


def script_seconds(lines: List[Line]) -> float:
    return sum(line.seconds for line in lines)


def display_name(agent_id: str) -> Optional[str]:
    return DISPLAY_NAMES.get(agent_id)
