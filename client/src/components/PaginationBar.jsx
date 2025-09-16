import React from 'react';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

export default function PaginationBar({ currentPage, perPage, totalResults, onGoToPage }) {
  if (totalResults <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
  const windowSize = 7;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" onClick={(e) => { e?.preventDefault?.(); if (currentPage > 1) onGoToPage(currentPage - 1); }} />
        </PaginationItem>

        {start > 1 && (
          <>
            <PaginationItem>
              <PaginationLink href="#" onClick={(e) => { e?.preventDefault?.(); onGoToPage(1); }}>1</PaginationLink>
            </PaginationItem>
            <PaginationItem><PaginationEllipsis /></PaginationItem>
          </>
        )}

        {pages.map(p => (
          <PaginationItem key={p}>
            <PaginationLink href="#" isActive={p === currentPage} onClick={(e) => { e?.preventDefault?.(); if (p !== currentPage) onGoToPage(p); }}>{p}</PaginationLink>
          </PaginationItem>
        ))}

        {end < totalPages && (
          <>
            <PaginationItem><PaginationEllipsis /></PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" onClick={(e) => { e?.preventDefault?.(); onGoToPage(totalPages); }}>{totalPages}</PaginationLink>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <PaginationNext href="#" onClick={(e) => { e?.preventDefault?.(); if (currentPage < totalPages) onGoToPage(currentPage + 1); }} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

