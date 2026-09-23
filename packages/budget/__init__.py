"""Atomic budget reservation and quota Foundation contracts."""

from .models import BudgetLimit, BudgetRequest, UsageReceipt, ProviderOutcome, BudgetDispatch
from .service import BudgetService

__all__ = ["BudgetLimit", "BudgetRequest", "BudgetService", "UsageReceipt", "ProviderOutcome", "BudgetDispatch",
           "CapabilityBudgetRouter", "RoutedRequest", "RoutePin", "RoutedDispatch", "RoutingError"]


def __getattr__(name):
    # D11 dependencies also import the B10 owners during initialization.
    if name in {"CapabilityBudgetRouter", "RoutedRequest", "RoutePin", "RoutedDispatch", "RoutingError"}:
        from . import routing
        return getattr(routing, name)
    raise AttributeError(name)
