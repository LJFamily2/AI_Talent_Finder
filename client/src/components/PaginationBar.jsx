import React from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

export default function PaginationBar({ currentPage, perPage, totalResults, onGoToPage, showFirstLast = false }) {
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
        {showFirstLast && (
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              className="mx-1.5 border border-gray-300 px-3"
              onClick={(e) => { e?.preventDefault?.(); if (currentPage !== 1) onGoToPage(1); }}
            >
              First Page
            </PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className="px-2.5 mx-1 flex items-center justify-center"
            aria-label="Go to previous page"
            onClick={(e) => { e?.preventDefault?.(); if (currentPage > 1) onGoToPage(currentPage - 1); }}
          >
            <FaChevronLeft className="w-4 h-4" />
          </PaginationLink>
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
          <PaginationLink
            href="#"
            size="default"
            className="px-2.5 mx-1 flex items-center justify-center"
            aria-label="Go to next page"
            onClick={(e) => { e?.preventDefault?.(); if (currentPage < totalPages) onGoToPage(currentPage + 1); }}
          >
            <FaChevronRight className="w-4 h-4" />
          </PaginationLink>
        </PaginationItem>
        {showFirstLast && (
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              className="mx-1.5 border border-gray-300 px-3"
              onClick={(e) => { e?.preventDefault?.(); if (currentPage !== totalPages) onGoToPage(totalPages); }}
            >
              Last Page
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
